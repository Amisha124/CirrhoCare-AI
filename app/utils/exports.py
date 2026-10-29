import csv
from datetime import datetime, timezone
from io import BytesIO, StringIO
from pathlib import Path

from flask import Response, current_app, request, send_file
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import func

from app.models import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report


# -----------------------------------------------------------------------------
# 1. Security: CSV Formula Injection Protection (CWE-1236)
# -----------------------------------------------------------------------------
def sanitize_csv_cell(value):
    """
    Protects against CSV Formula Injection (CWE-1236).
    If a text value starts with =, +, -, @, tab, or newline,
    prepends a single quote (') to neutralize execution in spreadsheet applications.
    """
    if value is None:
        return ""
    val_str = str(value)
    stripped = val_str.lstrip()
    if stripped and stripped[0] in ("=", "+", "-", "@", "\t", "\r", "%"):
        return f"'{val_str}"
    return val_str


# -----------------------------------------------------------------------------
# 2. Numbered Canvas for Professional Multi-Page PDF Header & Footer
# -----------------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that computes total page count dynamically
    and draws consistent running headers, footers, and page numbers.
    """

    def __init__(self, *args, **kwargs):
        kwargs["pageCompression"] = 0
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(54, 46, 612 - 54, 46)

        # Footer Left: Classification & System Notice
        self.drawString(
            54,
            32,
            "CONFIDENTIAL MEDICAL RECORD — CIRRHOCARE AI CLINICAL DECISION SUPPORT",
        )

        # Footer Right: Page X of Y
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(612 - 54, 32, page_str)

        # Header for pages > 1
        if self._pageNumber > 1:
            self.drawString(
                54,
                792 - 36,
                "CirrhoCare AI — Patient Registry & Clinical Evaluation Summary",
            )
            self.drawRightString(
                612 - 54,
                792 - 36,
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            )
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(54, 792 - 42, 612 - 54, 792 - 42)

        self.restoreState()


# -----------------------------------------------------------------------------
# 3. Query Scoping and Parameter Validation
# -----------------------------------------------------------------------------
def parse_date_safely(date_str, is_end=False):
    """
    Parses ISO date string or YYYY-MM-DD.
    Returns datetime object or raises ValueError if malformed.
    """
    if not date_str:
        return None
    s = str(date_str).strip()
    if not s:
        return None
    try:
        if len(s) == 10 and s.count("-") == 2:
            dt = datetime.strptime(s, "%Y-%m-%d")
        else:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        if is_end:
            dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        return dt
    except Exception as e:
        raise ValueError(f"Invalid date format '{s}'. Expected YYYY-MM-DD or ISO 8601.")


def build_authorized_export_query(user, args):
    """
    Validates all search and filter parameters strictly and builds
    the role-authorized SQLAlchemy query for patient records.
    Raises ValueError with user-friendly message on invalid parameters.
    """
    if not user or not user.is_authenticated:
        raise PermissionError("Authentication required.")

    query = Patient.query

    # 1. Role Scoping
    if user.role == "patient":
        # Patients can only access their own patient record
        patient_filter = (Patient.portal_id == user.portal_id)
        if user.email:
            patient_filter = patient_filter | (Patient.email.ilike(user.email.strip().lower()))
        query = query.filter(patient_filter)

    elif user.role == "hepatologist":
        my_appnt_patients = db.session.query(Appointment.patient_id).filter_by(doctor_id=user.id)
        my_rx_patients = db.session.query(Prescription.patient_id).filter_by(doctor_id=user.id)

        scope = str(args.get("scope") or "my_patients").strip()
        allowed_scopes = {"my_patients", "all_accessible"}
        if scope not in allowed_scopes:
            raise ValueError(f"Invalid scope '{scope}'. Allowed: {', '.join(sorted(allowed_scopes))}")

        if scope == "all_accessible":
            other_doc_appnt_patients = db.session.query(Appointment.patient_id).filter(
                Appointment.doctor_id != user.id,
                Appointment.doctor_id.isnot(None),
            ).distinct()
            other_doc_rx_patients = db.session.query(Prescription.patient_id).filter(
                Prescription.doctor_id != user.id,
                Prescription.doctor_id.isnot(None),
            ).distinct()
            query = query.filter(
                (Patient.id.in_(my_appnt_patients))
                | (Patient.id.in_(my_rx_patients))
                | (Patient.created_by_id == user.id)
                | (~Patient.id.in_(other_doc_appnt_patients) & ~Patient.id.in_(other_doc_rx_patients))
            )
        else:
            query = query.filter(
                (Patient.id.in_(my_appnt_patients))
                | (Patient.id.in_(my_rx_patients))
                | (Patient.created_by_id == user.id)
            )

    elif user.role in ("admin", "labtech"):
        # Authorized across full clinical registry
        pass
    else:
        raise PermissionError(f"Role '{user.role}' is not authorized to export patient records.")

    # 2. Specific Patient ID Filter (if requested)
    patient_id_raw = args.get("patient_id")
    if patient_id_raw:
        try:
            pid = int(patient_id_raw)
            query = query.filter(Patient.id == pid)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid patient_id format: '{patient_id_raw}'. Must be an integer.")

    # 3. Search Keyword
    q = str(args.get("q") or "").strip()
    if q:
        query = query.filter(
            (Patient.full_name.ilike(f"%{q}%"))
            | (Patient.portal_id.ilike(f"%{q}%"))
            | (Patient.email.ilike(f"%{q}%"))
            | (Patient.phone.ilike(f"%{q}%"))
        )

    # 4. Risk Level Filter
    risk = str(args.get("risk") or "").strip()
    if risk:
        allowed_risks = {"High Risk", "Medium Risk", "Low Risk", "Pending"}
        if risk not in allowed_risks:
            raise ValueError(f"Invalid risk filter: '{risk}'. Allowed: {', '.join(sorted(allowed_risks))}")
        query = query.filter(Patient.latest_risk_label == risk)

    # 5. Treatment Status Filter
    status = str(args.get("status") or "").strip()
    if status:
        allowed_statuses = {"Under treatment", "Needs urgent review", "Awaiting review", "Stable"}
        if status not in allowed_statuses:
            raise ValueError(f"Invalid status filter: '{status}'. Allowed: {', '.join(sorted(allowed_statuses))}")
        query = query.filter(Patient.treatment_status == status)

    # 6. Date Range Filtering
    start_date_str = str(args.get("start_date") or "").strip()
    end_date_str = str(args.get("end_date") or "").strip()
    start_dt = parse_date_safely(start_date_str, is_end=False)
    end_dt = parse_date_safely(end_date_str, is_end=True)

    if start_dt and end_dt and start_dt > end_dt:
        raise ValueError(f"start_date ({start_date_str}) cannot be later than end_date ({end_date_str}).")

    if start_dt:
        query = query.filter(Patient.created_at >= start_dt)
    if end_dt:
        query = query.filter(Patient.created_at <= end_dt)

    # 7. Safe Sorting
    sort_cols = {
        "created_at": Patient.created_at,
        "full_name": Patient.full_name,
        "age": Patient.age,
        "latest_risk_label": Patient.latest_risk_label,
        "latest_risk_percent": Patient.latest_risk_percent,
        "treatment_status": Patient.treatment_status,
        "portal_id": Patient.portal_id,
    }
    sort_by = str(args.get("sort_by") or "created_at").strip()
    if sort_by not in sort_cols:
        raise ValueError(f"Invalid sort_by column: '{sort_by}'. Allowed: {', '.join(sorted(sort_cols.keys()))}")

    sort_dir = str(args.get("sort_dir") or "desc").strip().lower()
    if sort_dir not in ("asc", "desc"):
        raise ValueError(f"Invalid sort_dir: '{sort_dir}'. Allowed: asc, desc")

    attr = sort_cols[sort_by]
    if sort_dir == "asc":
        query = query.order_by(attr.asc())
    else:
        query = query.order_by(attr.desc())

    # Build human-readable filter summary for metadata
    filter_parts = []
    if q:
        filter_parts.append(f"Search: '{q}'")
    if risk:
        filter_parts.append(f"Risk: {risk}")
    if status:
        filter_parts.append(f"Status: {status}")
    if start_dt or end_dt:
        range_str = f"{start_date_str or 'Earliest'} to {end_date_str or 'Latest'}"
        filter_parts.append(f"Date Range: {range_str}")
    if user.role == "hepatologist":
        filter_parts.append(f"Doctor Scope: {scope}")

    filter_summary = " | ".join(filter_parts) if filter_parts else "All Accessible Records"

    return query, filter_summary


# -----------------------------------------------------------------------------
# 4. CSV Export Generator
# -----------------------------------------------------------------------------
def generate_patients_csv(user=None, args=None, explicit_patients=None):
    """
    Generates a secure, RFC-4180 compliant CSV export of authorized patient records.
    Protects against CSV Formula Injection, enforces UTF-8 BOM encoding for Excel,
    and applies active search and filter constraints safely.
    """
    if explicit_patients is not None:
        patients = explicit_patients
        is_page = False
        page_num = 1
    else:
        args = args or {}
        query, _ = build_authorized_export_query(user, args)

        # Check if page export requested
        current_page_flag = str(args.get("current_page", "")).lower() in ("true", "1")
        if current_page_flag:
            page = max(1, int(args.get("page", 1)))
            per_page = min(100, max(1, int(args.get("per_page", 20))))
            patients = query.offset((page - 1) * per_page).limit(per_page).all()
            is_page = True
            page_num = page
        else:
            patients = query.all()
            is_page = False
            page_num = 1

    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Professional standardized medical registry headers
    headers = [
        "Patient ID",
        "Full Name",
        "Age",
        "Gender",
        "Risk Level",
        "Risk Probability (%)",
        "Treatment Status",
        "Bilirubin (mg/dL)",
        "Albumin (g/dL)",
        "Platelets (x10^3/uL)",
        "SGOT/AST (U/L)",
        "SGPT/ALT (U/L)",
        "Prothrombin Time (s)",
        "Registration Date (UTC)",
    ]
    writer.writerow(headers)

    for p in patients:
        writer.writerow([
            sanitize_csv_cell(p.portal_id or f"PAT-{p.id:04d}"),
            sanitize_csv_cell(p.full_name),
            p.age if p.age is not None else "",
            sanitize_csv_cell(p.gender or ""),
            sanitize_csv_cell(p.latest_risk_label or "Pending"),
            f"{p.latest_risk_percent:.1f}" if p.latest_risk_percent is not None else "0.0",
            sanitize_csv_cell(p.treatment_status or "Awaiting review"),
            f"{p.bilirubin:.2f}" if p.bilirubin is not None else "",
            f"{p.albumin:.2f}" if p.albumin is not None else "",
            f"{p.platelets:.1f}" if p.platelets is not None else "",
            f"{p.sgot:.1f}" if p.sgot is not None else "",
            f"{p.sgpt:.1f}" if p.sgpt is not None else "",
            f"{p.prothrombin:.1f}" if p.prothrombin is not None else "",
            p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else "",
        ])

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix = f"_page{page_num}" if is_page else ""
    filename = f"cirrhocare_patients_{timestamp_str}{suffix}.csv"

    # Encode with UTF-8 BOM ('utf-8-sig') so Excel on Windows/Mac opens without mojibake
    csv_bytes = output.getvalue().encode("utf-8-sig")

    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


# -----------------------------------------------------------------------------
# 5. PDF Export Generator
# -----------------------------------------------------------------------------
def generate_summary_pdf(user=None, args=None, explicit_patients=None):
    """
    Generates a professional, multi-page clinical report PDF using ReportLab Platypus.
    Includes:
    - Header & Metadata Banner (Generated timestamp, user role, active filters)
    - Executive KPI Metrics summary block
    - Detailed Patient Evaluation Table with auto-wrap and safe multi-page splits
    - Prominent Experimental AI Model Disclaimer
    - Numbered footer (Page X of Y)
    """
    if explicit_patients is not None:
        patients = explicit_patients
        filter_summary = "Custom Selection"
        is_page = False
        page_num = 1
    else:
        args = args or {}
        query, filter_summary = build_authorized_export_query(user, args)

        current_page_flag = str(args.get("current_page", "")).lower() in ("true", "1")
        if current_page_flag:
            page = max(1, int(args.get("page", 1)))
            per_page = min(100, max(1, int(args.get("per_page", 20))))
            patients = query.offset((page - 1) * per_page).limit(per_page).all()
            is_page = True
            page_num = page
        else:
            patients = query.all()
            is_page = False
            page_num = 1

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
        title="CirrhoCare AI Clinical Report",
        author="CirrhoCare AI System",
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f766e"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12,
    )
    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b"),
    )
    cell_bold_style = ParagraphStyle(
        "TableCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    disclaimer_heading = ParagraphStyle(
        "DisclaimerHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#991b1b"),
        spaceAfter=3,
    )
    disclaimer_text = ParagraphStyle(
        "DisclaimerText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#7f1d1d"),
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("CirrhoCare AI — Clinical Decision Support", title_style))
    scope_notice = f" (Page {page_num})" if is_page else ""
    story.append(Paragraph(f"Patient Registry & Clinical Risk Evaluation Summary{scope_notice}", subtitle_style))

    # 2. Metadata Block (Generated Date, Requestor, Filters)
    now_utc = datetime.now(timezone.utc).strftime("%d %b %Y at %H:%M UTC")
    requestor = f"{user.name} ({user.role.capitalize()})" if user else "Authorized System Clinician"
    meta_table_data = [
        [
            Paragraph(f"<b>Generated At:</b> {now_utc}", meta_style),
            Paragraph(f"<b>Requested By:</b> {requestor}", meta_style),
        ],
        [
            Paragraph(f"<b>Active Filters:</b> {filter_summary}", meta_style),
            Paragraph(f"<b>Scope:</b> {'Current Page Only' if is_page else 'All Matching Records'} ({len(patients)} patients)", meta_style),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[250, 254])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # 3. KPI Metrics Summary Cards (Total, High Risk, Medium, Low/Pending)
    high_count = sum(1 for p in patients if p.latest_risk_label == "High Risk")
    med_count = sum(1 for p in patients if p.latest_risk_label == "Medium Risk")
    low_count = sum(1 for p in patients if p.latest_risk_label == "Low Risk")
    pending_count = sum(1 for p in patients if p.latest_risk_label not in ("High Risk", "Medium Risk", "Low Risk"))

    kpi_data = [
        [
            Paragraph("<b>Total Patients</b>", meta_style),
            Paragraph("<b>High Risk (Critical)</b>", meta_style),
            Paragraph("<b>Medium Risk</b>", meta_style),
            Paragraph("<b>Low Risk / Pending</b>", meta_style),
        ],
        [
            Paragraph(f"<font size=12><b>{len(patients)}</b></font>", meta_style),
            Paragraph(f"<font size=12 color='#e11d48'><b>{high_count}</b></font>", meta_style),
            Paragraph(f"<font size=12 color='#d97706'><b>{med_count}</b></font>", meta_style),
            Paragraph(f"<font size=12 color='#059669'><b>{low_count + pending_count}</b></font>", meta_style),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[126, 126, 126, 126])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#e2e8f0")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # 4. Patient Registry Table
    if not patients:
        empty_box = Table(
            [[Paragraph("<b>No patient records match the specified search or filter criteria.</b>", meta_style)]],
            colWidths=[504],
        )
        empty_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 16),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        story.append(empty_box)
    else:
        # Table Header
        table_rows = [[
            Paragraph("<b>ID</b>", table_header_style),
            Paragraph("<b>Patient Name</b>", table_header_style),
            Paragraph("<b>Age/Sex</b>", table_header_style),
            Paragraph("<b>Risk Tier</b>", table_header_style),
            Paragraph("<b>Prob %</b>", table_header_style),
            Paragraph("<b>Status</b>", table_header_style),
            Paragraph("<b>Key Biomarkers</b>", table_header_style),
        ]]

        col_widths = [60, 110, 48, 65, 42, 85, 94]

        for idx, p in enumerate(patients):
            bg_color = colors.HexColor("#f8fafc") if idx % 2 == 1 else colors.white

            risk_label = p.latest_risk_label or "Pending"
            if risk_label == "High Risk":
                risk_color = "#e11d48"
            elif risk_label == "Medium Risk":
                risk_color = "#d97706"
            elif risk_label == "Low Risk":
                risk_color = "#059669"
            else:
                risk_color = "#64748b"

            biomarker_summary = (
                f"Bili: {p.bilirubin:.1f} | Alb: {p.albumin:.1f} | Plt: {p.platelets:.0f}"
                if (p.bilirubin or p.albumin or p.platelets)
                else "—"
            )

            row = [
                Paragraph(sanitize_csv_cell(p.portal_id or f"PAT-{p.id:04d}"), cell_style),
                Paragraph(f"<b>{sanitize_csv_cell(p.full_name)}</b>", cell_style),
                Paragraph(f"{p.age or '—'} / {p.gender[0] if p.gender else '—'}", cell_style),
                Paragraph(f"<font color='{risk_color}'><b>{risk_label}</b></font>", cell_style),
                Paragraph(f"{p.latest_risk_percent:.1f}%" if p.latest_risk_percent is not None else "—", cell_style),
                Paragraph(sanitize_csv_cell(p.treatment_status or "Awaiting review"), cell_style),
                Paragraph(biomarker_summary, cell_style),
            ]
            table_rows.append(row)

        patient_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
        patient_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(patient_table)

    story.append(Spacer(1, 16))

    # 5. Mandatory Experimental AI Model Disclaimer Callout Box
    disclaimer_box = Table(
        [
            [Paragraph("<b>CRITICAL CLINICAL NOTICE &amp; EXPERIMENTAL AI DISCLAIMER:</b>", disclaimer_heading)],
            [Paragraph(
                "CirrhoCare AI predictive risk stratification scores and probability percentages are generated "
                "by an <b>experimental machine learning research model</b> designed exclusively for preliminary clinical "
                "decision support. <b>This experimental model is NOT clinically validated, cleared, or approved as an independent "
                "diagnostic test, diagnostic device, or standalone clinical protocol.</b> All prognostic predictions must be "
                "independently reviewed and verified by a licensed hepatologist or physician in conjunction with complete "
                "clinical evaluations, patient history, and certified laboratory diagnostic assays prior to making therapeutic decisions.",
                disclaimer_text,
            )],
        ],
        colWidths=[504],
    )
    disclaimer_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#f87171")),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether([disclaimer_box]))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix = f"_page{page_num}" if is_page else ""
    filename = f"cirrhocare_report_{timestamp_str}{suffix}.pdf"

    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype="application/pdf",
    )
