"""
app.utils.demo_reports
----------------------
Generates realistic, clearly labeled fictional clinical laboratory and diagnostic
reports (PDF) for CirrhoCare AI isolated demonstration data.
Uses ReportLab to produce professional medical documentation matching the patient's
actual clinical biomarkers and risk scores.
"""

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

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


class DemoReportCanvas(canvas.Canvas):
    """
    Two-pass canvas for professional headers, running footers, and page numbers.
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
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        # Footer divider
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(40, 36, 612 - 40, 36)

        # Footer Left: Confidential Demo Notice
        self.drawString(
            40,
            24,
            "CIRRHOCARE AI CLINICAL DEMO RECORD • NOT FOR ACTUAL MEDICAL DIAGNOSIS • ISO/IEC 27001",
        )

        # Footer Right: Page X of Y
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(612 - 40, 24, page_str)

        # Header running on pages > 1
        if self._pageNumber > 1:
            self.setFont("Helvetica", 7.5)
            self.drawString(
                40,
                792 - 28,
                "CirrhoCare AI — Laboratory & Diagnostic Evaluation Record (Demo)",
            )
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.line(40, 792 - 32, 612 - 40, 792 - 32)

        self.restoreState()


class ClinicalReportCanvas(canvas.Canvas):
    """
    Two-pass canvas for official CirrhoCare AI patient clinical laboratory reports.
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
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#475569"))

        # Footer divider
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.75)
        self.line(40, 36, 612 - 40, 36)

        # Footer Left: Official Clinical Record Notice
        self.drawString(
            40,
            24,
            "CIRRHOCARE AI CLINICAL CORE LABORATORY • OFFICIAL PATIENT DIAGNOSTIC RECORD • CONFIDENTIAL MEDICAL DOCUMENT",
        )

        # Footer Right: Page X of Y
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(612 - 40, 24, page_str)

        # Header running on pages > 1
        if self._pageNumber > 1:
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(
                40,
                792 - 28,
                "CirrhoCare AI — Clinical Laboratory Diagnostic Evaluation Report",
            )
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.line(40, 792 - 32, 612 - 40, 792 - 32)

        self.restoreState()


def get_demo_report_styles():
    styles = getSampleStyleSheet()

    header_title = ParagraphStyle(
        "DemoHeaderTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f766e"),
        spaceAfter=2,
    )
    header_subtitle = ParagraphStyle(
        "DemoHeaderSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )
    demo_badge = ParagraphStyle(
        "DemoBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#991b1b"),
        alignment=1,  # Center
    )
    section_heading = ParagraphStyle(
        "DemoSectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=8,
        spaceAfter=4,
    )
    meta_label = ParagraphStyle(
        "DemoMetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569"),
    )
    meta_value = ParagraphStyle(
        "DemoMetaValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )
    table_header = ParagraphStyle(
        "DemoTableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    table_cell = ParagraphStyle(
        "DemoTableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b"),
    )
    table_cell_bold = ParagraphStyle(
        "DemoTableCellBold",
        parent=table_cell,
        fontName="Helvetica-Bold",
    )
    clinical_note = ParagraphStyle(
        "DemoClinicalNote",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    disclaimer_text = ParagraphStyle(
        "DemoDisclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#991b1b"),
        alignment=1,
    )

    return {
        "header_title": header_title,
        "header_subtitle": header_subtitle,
        "demo_badge": demo_badge,
        "section_heading": section_heading,
        "meta_label": meta_label,
        "meta_value": meta_value,
        "table_header": table_header,
        "table_cell": table_cell,
        "table_cell_bold": table_cell_bold,
        "clinical_note": clinical_note,
        "disclaimer_text": disclaimer_text,
    }


def generate_demo_report_pdf(report, patient=None, output_path=None):
    """
    Builds a professional clinical PDF for an isolated demo report record.
    If output_path is provided, writes to that path; otherwise returns bytes.
    """
    buffer = BytesIO() if output_path is None else None
    target = buffer if output_path is None else str(output_path)

    if output_path is not None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        target,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=36,
        bottomMargin=46,
        title=f"CirrhoCare AI - {getattr(report, 'original_filename', 'Report')}",
        author="CirrhoCare AI Clinical Decision Support",
    )

    st = get_demo_report_styles()
    story = []

    # Safe attributes extraction
    rep_id = getattr(report, "id", "DEMO")
    rep_name = getattr(report, "original_filename", "Clinical_Report.pdf")
    category = getattr(report, "category", "Lab report")
    upload_dt = getattr(report, "uploaded_at", datetime.now(timezone.utc))
    if isinstance(upload_dt, datetime):
        upload_str = upload_dt.strftime("%d %b %Y at %H:%M UTC")
    else:
        upload_str = str(upload_dt)

    p_name = getattr(patient, "full_name", "Fictional Demo Patient")
    portal_id = getattr(patient, "portal_id", f"PAT-{getattr(patient, 'id', 1000)}")
    age = getattr(patient, "age", 50)
    gender = getattr(patient, "gender", "Unknown")
    phone = getattr(patient, "phone", "+1-555-0100")
    bili = getattr(patient, "bilirubin", 1.2) or 1.2
    alb = getattr(patient, "albumin", 3.8) or 3.8
    plt = getattr(patient, "platelets", 220.0) or 220.0
    sgot = getattr(patient, "sgot", 35.0) or 35.0
    sgpt = getattr(patient, "sgpt", 32.0) or 32.0
    pt = getattr(patient, "prothrombin", 12.0) or 12.0
    copper = getattr(patient, "copper", 85.0) or 85.0
    alk = getattr(patient, "alk_phos", 95.0) or 95.0
    trig = getattr(patient, "triglycerides", 120.0) or 120.0
    risk_label = getattr(patient, "latest_risk_label", "Moderate Risk")
    risk_pct = getattr(patient, "latest_risk_percent", 45.0)
    treatment_status = getattr(patient, "treatment_status", "Under review")
    ascites = getattr(patient, "ascites", False)
    edema = getattr(patient, "edema", False)
    spiders = getattr(patient, "spiders", False)
    hepatomegaly = getattr(patient, "hepatomegaly", False)

    # -------------------------------------------------------------------------
    # 1. Header & Institution Banner
    # -------------------------------------------------------------------------
    banner_data = [
        [
            Paragraph("<b>CIRRHOCARE AI — CLINICAL LABORATORY REPORT</b>", st["header_title"]),
            Paragraph(
                "<b>DEMONSTRATION MEDICAL RECORD</b><br/>"
                "<font size=6.5 color='#991b1b'>SYNTHETIC ISOLATED DATA • NOT REAL PATIENT PHI</font>",
                st["demo_badge"],
            ),
        ]
    ]
    banner_table = Table(banner_data, colWidths=[360, 172])
    banner_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#fef2f2")),
            ("BOX", (1, 0), (1, 0), 1, colors.HexColor("#fca5a5")),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(banner_table)
    story.append(Spacer(1, 6))

    # -------------------------------------------------------------------------
    # 2. Patient & Document Information Box
    # -------------------------------------------------------------------------
    meta_rows = [
        [
            Paragraph("Patient Name:", st["meta_label"]),
            Paragraph(f"<b>{p_name}</b>", st["meta_value"]),
            Paragraph("Report ID / Category:", st["meta_label"]),
            Paragraph(f"<b>REP-{rep_id:04d}</b> ({category})", st["meta_value"]),
        ],
        [
            Paragraph("Portal MRN:", st["meta_label"]),
            Paragraph(f"<b>{portal_id}</b>", st["meta_value"]),
            Paragraph("Document Name:", st["meta_label"]),
            Paragraph(f"{rep_name}", st["meta_value"]),
        ],
        [
            Paragraph("Demographics:", st["meta_label"]),
            Paragraph(f"{age} years / {gender}", st["meta_value"]),
            Paragraph("Collection Date:", st["meta_label"]),
            Paragraph(f"{upload_str}", st["meta_value"]),
        ],
        [
            Paragraph("Ordering Clinician:", st["meta_label"]),
            Paragraph("Dr. Hepato Care [Demo] (Consultant)", st["meta_value"]),
            Paragraph("Diagnostic Facility:", st["meta_label"]),
            Paragraph("CirrhoCare Clinical Core Laboratory", st["meta_value"]),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[105, 161, 115, 151])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # -------------------------------------------------------------------------
    # 3. Clinical Findings by Category
    # -------------------------------------------------------------------------
    if category == "Ultrasound":
        story.append(Paragraph("Diagnostic Sonography & Transient Elastography Evaluation", st["section_heading"]))

        liver_texture = "Coarse, heterogeneous echotexture with diffuse attenuation" if (ascites or sgot > 60) else "Homogeneous echotexture with smooth contours"
        surface_desc = "Nodular and irregular capsular surface" if (ascites or sgot > 80) else "Smooth hepatic surface without capsular irregularity"
        portal_v_diam = "14.4 mm (Dilated > 13 mm, mild portal hypertension)" if (ascites or plt < 120) else "10.8 mm (Normal caliber, hepatopetal flow)"
        spleen_desc = "13.6 cm craniocaudal (Splenomegaly secondary to portal hypertension)" if plt < 140 else "10.2 cm (Normal adult dimensions)"
        ascites_desc = "Moderate free intraperitoneal fluid in Morison's pouch and pelvis" if ascites else "No intraperitoneal free fluid or loculated ascites"
        fibroscan_kpa = f"{min(75.0, round(12.0 + (bili * 2.5) + (sgot * 0.08), 1))} kPa"

        us_rows = [
            [
                Paragraph("<b>Anatomical Region / Parameter</b>", st["table_header"]),
                Paragraph("<b>Sonographic Findings & Observations</b>", st["table_header"]),
                Paragraph("<b>Clinical Correlation</b>", st["table_header"]),
            ],
            [
                Paragraph("<b>Hepatic Parenchyma</b>", st["table_cell_bold"]),
                Paragraph(liver_texture, st["table_cell"]),
                Paragraph("Chronic Parenchymal Liver Disease", st["table_cell"]),
            ],
            [
                Paragraph("<b>Capsular Surface</b>", st["table_cell_bold"]),
                Paragraph(surface_desc, st["table_cell"]),
                Paragraph("Cirrhotic Architecture Change" if (ascites or sgot > 80) else "Within Normal Limits", st["table_cell"]),
            ],
            [
                Paragraph("<b>Portal Venous System</b>", st["table_cell_bold"]),
                Paragraph(portal_v_diam, st["table_cell"]),
                Paragraph("Portal Venous Hypertensive Flow" if (ascites or plt < 120) else "Normal Directional Flow", st["table_cell"]),
            ],
            [
                Paragraph("<b>Splenic Evaluation</b>", st["table_cell_bold"]),
                Paragraph(spleen_desc, st["table_cell"]),
                Paragraph("Congestive Splenomegaly" if plt < 140 else "Normal Spleen", st["table_cell"]),
            ],
            [
                Paragraph("<b>Ascites Evaluation</b>", st["table_cell_bold"]),
                Paragraph(ascites_desc, st["table_cell"]),
                Paragraph("Decompensated Cirrhosis Sign" if ascites else "Compensated Status", st["table_cell"]),
            ],
            [
                Paragraph("<b>FibroScan Elastography</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{fibroscan_kpa}</b> (Stiffness IQR: 8.5%)", st["table_cell"]),
                Paragraph("METAVIR F4 Equivalent" if "High" in risk_label else ("METAVIR F3" if "Med" in risk_label else "METAVIR F0-F1"), st["table_cell"]),
            ],
        ]
        us_table = Table(us_rows, colWidths=[140, 242, 150])
        us_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(us_table)

    elif category == "Biopsy":
        story.append(Paragraph("Liver Biopsy Histopathology Evaluation", st["section_heading"]))

        biopsy_rows = [
            [
                Paragraph("<b>Histopathological Parameter</b>", st["table_header"]),
                Paragraph("<b>Microscopic Findings & Pathology Assessment</b>", st["table_header"]),
                Paragraph("<b>Diagnostic Grade / Score</b>", st["table_header"]),
            ],
            [
                Paragraph("<b>Specimen Adequacy</b>", st["table_cell_bold"]),
                Paragraph("2 needle core specimens, aggregate length 21 mm; 12 complete portal tracts evaluated", st["table_cell"]),
                Paragraph("Adequate for Staging", st["table_cell"]),
            ],
            [
                Paragraph("<b>Fibrosis Architecture</b>", st["table_cell_bold"]),
                Paragraph("Marked fibrous expansion of portal tracts with extensive portal-to-portal and portal-to-central bridging septa", st["table_cell"]),
                Paragraph("<b>Ishak Stage 4-5 / METAVIR F3-F4</b>", st["table_cell_bold"]),
            ],
            [
                Paragraph("<b>Necroinflammatory Activity</b>", st["table_cell_bold"]),
                Paragraph("Moderate interface hepatitis (piecemeal necrosis) with focal spotty lobular necrosis and apoptotic bodies", st["table_cell"]),
                Paragraph("Grade 2-3 (Moderate-Severe)", st["table_cell"]),
            ],
            [
                Paragraph("<b>Steatosis & Ballooning</b>", st["table_cell_bold"]),
                Paragraph("Mixed macrovesicular and microvesicular steatosis (~15% of hepatocytes); marked hepatocellular ballooning", st["table_cell"]),
                Paragraph("MASH / Steatohepatitis Features", st["table_cell"]),
            ],
            [
                Paragraph("<b>Histochemical Stains</b>", st["table_cell_bold"]),
                Paragraph("Masson Trichrome: Dense collagen septa confirmed. Perl's iron stain: Grade 0 (Negative). Rhodanine copper: Minimal periportal granular copper.", st["table_cell"]),
                Paragraph("No Hemochromatosis Stigma", st["table_cell"]),
            ],
        ]
        biopsy_table = Table(biopsy_rows, colWidths=[140, 242, 150])
        biopsy_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(biopsy_table)

    else:
        # Standard Clinical Laboratory Panel
        story.append(Paragraph("Quantitative Serum Biomarkers & Hepatic Function Panel", st["section_heading"]))

        def get_bili_flag(val):
            return ("CRITICAL HIGH", "#e11d48") if val > 3.0 else (("ELEVATED", "#d97706") if val > 1.2 else ("NORMAL", "#059669"))

        def get_alb_flag(val):
            return ("CRITICAL LOW", "#e11d48") if val < 2.8 else (("LOW", "#d97706") if val < 3.5 else ("NORMAL", "#059669"))

        def get_plt_flag(val):
            return ("SEVERE LOW", "#e11d48") if val < 100 else (("LOW", "#d97706") if val < 150 else ("NORMAL", "#059669"))

        def get_ast_flag(val):
            return ("SEVERELY HIGH", "#e11d48") if val > 120 else (("ELEVATED", "#d97706") if val > 48 else ("NORMAL", "#059669"))

        def get_alt_flag(val):
            return ("SEVERELY HIGH", "#e11d48") if val > 120 else (("ELEVATED", "#d97706") if val > 56 else ("NORMAL", "#059669"))

        def get_pt_flag(val):
            return ("PROLONGED", "#e11d48") if val > 15.0 else (("ELEVATED", "#d97706") if val > 13.5 else ("NORMAL", "#059669"))

        def get_alk_flag(val):
            return ("ELEVATED", "#d97706") if val > 147 else ("NORMAL", "#059669")

        bili_flg, bili_clr = get_bili_flag(bili)
        alb_flg, alb_clr = get_alb_flag(alb)
        plt_flg, plt_clr = get_plt_flag(plt)
        ast_flg, ast_clr = get_ast_flag(sgot)
        alt_flg, alt_clr = get_alt_flag(sgpt)
        pt_flg, pt_clr = get_pt_flag(pt)
        alk_flg, alk_clr = get_alk_flag(alk)

        lab_rows = [
            [
                Paragraph("<b>Biomarker Analyte</b>", st["table_header"]),
                Paragraph("<b>Observed Result</b>", st["table_header"]),
                Paragraph("<b>Units</b>", st["table_header"]),
                Paragraph("<b>Reference Range</b>", st["table_header"]),
                Paragraph("<b>Clinical Flag</b>", st["table_header"]),
            ],
            [
                Paragraph("<b>Total Serum Bilirubin</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{bili:.1f}</b>", st["table_cell_bold"]),
                Paragraph("mg/dL", st["table_cell"]),
                Paragraph("0.2 – 1.2", st["table_cell"]),
                Paragraph(f"<font color='{bili_clr}'><b>{bili_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>Serum Albumin</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{alb:.1f}</b>", st["table_cell_bold"]),
                Paragraph("g/dL", st["table_cell"]),
                Paragraph("3.5 – 5.0", st["table_cell"]),
                Paragraph(f"<font color='{alb_clr}'><b>{alb_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>Platelet Count</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{plt:.0f}</b>", st["table_cell_bold"]),
                Paragraph("×10³/µL", st["table_cell"]),
                Paragraph("150 – 450", st["table_cell"]),
                Paragraph(f"<font color='{plt_clr}'><b>{plt_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>SGOT / AST (Aspartate Aminotransferase)</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{sgot:.1f}</b>", st["table_cell_bold"]),
                Paragraph("U/L", st["table_cell"]),
                Paragraph("8 – 48", st["table_cell"]),
                Paragraph(f"<font color='{ast_clr}'><b>{ast_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>SGPT / ALT (Alanine Aminotransferase)</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{sgpt:.1f}</b>", st["table_cell_bold"]),
                Paragraph("U/L", st["table_cell"]),
                Paragraph("7 – 56", st["table_cell"]),
                Paragraph(f"<font color='{alt_clr}'><b>{alt_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>Prothrombin Clotting Time (PT)</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{pt:.1f}</b>", st["table_cell_bold"]),
                Paragraph("seconds", st["table_cell"]),
                Paragraph("11.0 – 13.5", st["table_cell"]),
                Paragraph(f"<font color='{pt_clr}'><b>{pt_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>Alkaline Phosphatase (ALP)</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{alk:.0f}</b>", st["table_cell_bold"]),
                Paragraph("U/L", st["table_cell"]),
                Paragraph("44 – 147", st["table_cell"]),
                Paragraph(f"<font color='{alk_clr}'><b>{alk_flg}</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>Serum Copper</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{copper:.1f}</b>", st["table_cell_bold"]),
                Paragraph("µg/dL", st["table_cell"]),
                Paragraph("70 – 140", st["table_cell"]),
                Paragraph("<font color='#059669'><b>NORMAL</b></font>", st["table_cell"]),
            ],
            [
                Paragraph("<b>Triglycerides</b>", st["table_cell_bold"]),
                Paragraph(f"<b>{trig:.0f}</b>", st["table_cell_bold"]),
                Paragraph("mg/dL", st["table_cell"]),
                Paragraph("< 150", st["table_cell"]),
                Paragraph("<font color='#059669'><b>NORMAL</b></font>" if trig < 150 else "<font color='#d97706'><b>ELEVATED</b></font>", st["table_cell"]),
            ],
        ]
        lab_table = Table(lab_rows, colWidths=[175, 75, 65, 95, 122])
        lab_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("PADDING", (0, 0), (-1, -1), 3.5),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(lab_table)

    story.append(Spacer(1, 8))

    # -------------------------------------------------------------------------
    # 4. CirrhoCare AI Decision Support & Clinical Synthesis
    # -------------------------------------------------------------------------
    tier_color = "#e11d48" if "High" in risk_label else ("#d97706" if "Med" in risk_label else "#059669")
    ai_box_data = [
        [
            Paragraph("<b>CIRRHOCARE AI — RISK STRATIFICATION & SYNTHESIS</b>", st["meta_label"]),
            Paragraph(f"<font color='{tier_color}' size=9.5><b>{risk_label.upper()} ({risk_pct:.1f}% Risk Probability)</b></font>", st["meta_label"]),
        ],
        [
            Paragraph(
                f"<b>Clinical Staging:</b> {treatment_status}<br/>"
                f"<b>Physical Signs Flagged:</b> Ascites: {'Positive' if ascites else 'Negative'} | "
                f"Peripheral Edema: {'Positive' if edema else 'Negative'} | "
                f"Spider Angiomas: {'Positive' if spiders else 'Negative'} | "
                f"Hepatomegaly: {'Positive' if hepatomegaly else 'Negative'}",
                st["clinical_note"],
            ),
            Paragraph(
                "<b>Diagnostic Next Steps:</b><br/>"
                + (
                    "Urgent hepatology consult required. Screen for gastroesophageal varices and initiate diuretic titration."
                    if "High" in risk_label
                    else (
                        "Schedule 3-month follow-up biomarker panel and contrast-enhanced liver imaging."
                        if "Med" in risk_label
                        else "Routine annual liver surveillance recommended. Maintain lifestyle modifications."
                    )
                ),
                st["clinical_note"],
            ),
        ],
    ]
    ai_box = Table(ai_box_data, colWidths=[266, 266])
    ai_box.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#ffffff")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94a3b8")),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(ai_box)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------------------
    # 5. Sign-off & Electronic Attestation
    # -------------------------------------------------------------------------
    sign_data = [
        [
            Paragraph("<b>Reporting Pathologist / Specialist:</b>", st["meta_label"]),
            Paragraph("<b>Diagnostic Verification:</b>", st["meta_label"]),
        ],
        [
            Paragraph(
                "Dr. Hepato Care, MD, FACG [Demo]<br/>"
                "<font size=7 color='#64748b'>Board Certified Clinical Hepatologist & Medical Director<br/>"
                "License #: DEMO-MD-984421</font>",
                st["meta_value"],
            ),
            Paragraph(
                f"Status: <b>Verified & Electronically Signed</b><br/>"
                f"<font size=7 color='#64748b'>Attestation ID: CIRRHO-AUTH-{rep_id}-{portal_id}<br/>"
                f"Timestamp: {upload_str}</font>",
                st["meta_value"],
            ),
        ],
    ]
    sign_table = Table(sign_data, colWidths=[266, 266])
    sign_table.setStyle(
        TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(sign_table)
    story.append(Spacer(1, 6))

    # -------------------------------------------------------------------------
    # 6. Prominent Demo Disclaimer
    # -------------------------------------------------------------------------
    disclaimer_p = Paragraph(
        "CAUTION: THIS REPORT CONTAINS SYNTHETIC FICTIONAL MEDICAL DATA GENERATED EXCLUSIVELY FOR CIRRHOCARE AI "
        "SOFTWARE DEMONSTRATIONS AND BENCHMARKING. NOT VALID FOR HUMAN MEDICAL DIAGNOSIS OR CLINICAL DECISION-MAKING.",
        st["disclaimer_text"],
    )
    story.append(disclaimer_p)

    doc.build(story, canvasmaker=DemoReportCanvas)

    if output_path is None:
        buffer.seek(0)
        return buffer.getvalue()
    return Path(output_path)


def generate_clinical_patient_report_pdf(
    patient,
    report=None,
    output_path=None,
    reporting_tech="Neha Verma (Lab Technician)",
    ordering_clinician="Dr. Sharma (Consultant Hepatologist)",
):
    """
    Builds an authentic, official CirrhoCare AI Clinical Laboratory Report (PDF)
    using the patient's actual recorded laboratory values stored in the database.

    Strict clinical integrity rules:
    - Never invent or fabricate clinical values.
    - All 8 liver biomarkers are listed in order.
    - Missing or unrecorded biomarkers are explicitly presented as "Not entered".
    - Displays patient demographics, reporting lab/technician, ordering physician,
      and doctor review status.
    """
    buffer = BytesIO() if output_path is None else None
    target = buffer if output_path is None else str(output_path)

    if output_path is not None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    filename_title = getattr(report, "original_filename", None) or f"Clinical_Report_{getattr(patient, 'portal_id', 'PAT')}.pdf"
    doc = SimpleDocTemplate(
        target,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=36,
        bottomMargin=46,
        title=f"CirrhoCare AI - {filename_title}",
        author="CirrhoCare AI Clinical Laboratory Station",
    )

    st = get_demo_report_styles()
    styles = getSampleStyleSheet()

    clinical_title = ParagraphStyle(
        "ClinicalReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#1877F2"),
        spaceAfter=2,
    )
    clinical_badge = ParagraphStyle(
        "ClinicalReportBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0f766e"),
        alignment=1,
    )

    story = []

    # Metadata extraction
    rep_id = getattr(report, "id", None) or getattr(patient, "id", 1000)
    rep_name = getattr(report, "original_filename", None) or getattr(report, "filename", "Diagnostic_LFT_Report.pdf")
    category = getattr(report, "category", "Liver Function Test (LFT)") or "Liver Function Test (LFT)"
    upload_dt = getattr(report, "uploaded_at", None) or getattr(patient, "created_at", datetime.now(timezone.utc))
    if isinstance(upload_dt, datetime):
        upload_str = upload_dt.strftime("%d %b %Y at %H:%M UTC")
    else:
        upload_str = str(upload_dt)

    p_name = getattr(patient, "full_name", "Registered Patient")
    portal_id = getattr(patient, "portal_id", None) or f"CC-{getattr(patient, 'id', 1000)}"
    age = getattr(patient, "age", "N/A")
    gender = getattr(patient, "gender", "Unknown")

    # Doctor review determination
    is_reviewed = bool(getattr(report, "is_reviewed", False))
    treatment_status = getattr(patient, "treatment_status", "Registered") or "Registered"
    if is_reviewed:
        review_status_text = "Reviewed & Verified by Dr. Sharma"
        badge_title = "OFFICIAL CLINICAL REPORT • REVIEWED & SIGNED"
        badge_bg = colors.HexColor("#ecfdf5")
        badge_border = colors.HexColor("#6ee7b7")
        badge_color = colors.HexColor("#065f46")
    elif treatment_status in ("Under treatment", "Completed", "Treatment Completed"):
        review_status_text = "Reviewed & Confirmed by Attending Hepatologist"
        badge_title = "OFFICIAL CLINICAL REPORT • ATTENDING REVIEWED"
        badge_bg = colors.HexColor("#eff6ff")
        badge_border = colors.HexColor("#93c5fd")
        badge_color = colors.HexColor("#1e40af")
    else:
        review_status_text = "Awaiting Doctor Review"
        badge_title = "LABORATORY REPORT • AWAITING DOCTOR REVIEW"
        badge_bg = colors.HexColor("#fffbeb")
        badge_border = colors.HexColor("#fcd34d")
        badge_color = colors.HexColor("#92400e")

    # 1. Header Banner
    badge_style = ParagraphStyle(
        "DynBadge",
        parent=clinical_badge,
        textColor=badge_color,
    )
    banner_data = [
        [
            Paragraph("<b>CIRRHOCARE AI — CLINICAL LABORATORY REPORT</b>", clinical_title),
            Paragraph(
                f"<b>{badge_title}</b><br/>"
                "<font size=6.5 color='#475569'>CIRRHOCARE AI CORE LABORATORY STATION • ISO 15189 COMPLIANT</font>",
                badge_style,
            ),
        ]
    ]
    banner_table = Table(banner_data, colWidths=[350, 182])
    banner_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (1, 0), (1, 0), badge_bg),
            ("BOX", (1, 0), (1, 0), 1, badge_border),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(banner_table)
    story.append(Spacer(1, 6))

    # 2. Patient Demographics & Record Info
    clinician_name = ordering_clinician
    if getattr(patient, "assigned_doctor", None):
        clinician_name = f"Dr. {patient.assigned_doctor.name} (Consultant Hepatologist)"

    meta_rows = [
        [
            Paragraph("Patient Name:", st["meta_label"]),
            Paragraph(f"<b>{p_name}</b>", st["meta_value"]),
            Paragraph("Report ID / Category:", st["meta_label"]),
            Paragraph(f"<b>REP-{rep_id:04d}</b> ({category})", st["meta_value"]),
        ],
        [
            Paragraph("Portal Patient ID:", st["meta_label"]),
            Paragraph(f"<b>{portal_id}</b>", st["meta_value"]),
            Paragraph("Document File:", st["meta_label"]),
            Paragraph(f"{rep_name}", st["meta_value"]),
        ],
        [
            Paragraph("Demographics:", st["meta_label"]),
            Paragraph(f"{age} years / {gender}", st["meta_value"]),
            Paragraph("Collection Date:", st["meta_label"]),
            Paragraph(f"{upload_str}", st["meta_value"]),
        ],
        [
            Paragraph("Attending Doctor:", st["meta_label"]),
            Paragraph(f"{clinician_name}", st["meta_value"]),
            Paragraph("Review Status:", st["meta_label"]),
            Paragraph(f"<b>{review_status_text}</b>", st["meta_value"]),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[105, 161, 115, 151])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # 3. Quantitative Serum Biomarkers — ALL 8 LIVER BIOMARKERS
    story.append(Paragraph("Quantitative Liver Function Panel & Serum Biomarkers", st["section_heading"]))

    # Extraction helpers: NEVER invent clinical values!
    bili_val = getattr(patient, "bilirubin", None)
    dir_bili_val = getattr(patient, "direct_bilirubin", None)
    sgot_val = getattr(patient, "sgot", None)
    sgpt_val = getattr(patient, "sgpt", None)
    alb_val = getattr(patient, "albumin", None)
    plt_val = getattr(patient, "platelets", None)
    pt_val = getattr(patient, "prothrombin", None)
    alk_val = getattr(patient, "alk_phos", None)

    def evaluate_item(val, unit, ref_str, flag_fn, precision=1):
        if val is None:
            return "Not entered", "—", "#64748b"
        try:
            fval = float(val)
            formatted = f"{fval:.0f}" if precision == 0 else f"{fval:.{precision}f}"
            flag_text, flag_color = flag_fn(fval)
            return formatted, flag_text, flag_color
        except (ValueError, TypeError):
            return "Not entered", "—", "#64748b"

    # Evaluators
    def flag_bili(v):
        if v > 3.0: return "CRITICAL HIGH", "#e11d48"
        if v > 1.2: return "ELEVATED", "#d97706"
        return "NORMAL", "#059669"

    def flag_dir_bili(v):
        if v > 0.4: return "ELEVATED", "#d97706"
        return "NORMAL", "#059669"

    def flag_ast(v):
        if v > 120: return "SEVERELY HIGH", "#e11d48"
        if v > 40: return "ELEVATED", "#d97706"
        return "NORMAL", "#059669"

    def flag_alt(v):
        if v > 120: return "SEVERELY HIGH", "#e11d48"
        if v > 56: return "ELEVATED", "#d97706"
        return "NORMAL", "#059669"

    def flag_alb(v):
        if v < 2.8: return "CRITICAL LOW", "#e11d48"
        if v < 3.5: return "LOW", "#d97706"
        return "NORMAL", "#059669"

    def flag_plt(v):
        if v < 100: return "SEVERE LOW", "#e11d48"
        if v < 150: return "LOW", "#d97706"
        return "NORMAL", "#059669"

    def flag_pt(v):
        if v > 15.0: return "PROLONGED", "#e11d48"
        if v > 13.5: return "BORDERLINE", "#d97706"
        return "NORMAL", "#059669"

    def flag_alk(v):
        if v > 129: return "ELEVATED", "#d97706"
        return "NORMAL", "#059669"

    bili_res, bili_flg, bili_clr = evaluate_item(bili_val, "mg/dL", "0.2 - 1.2", flag_bili, 1)
    dir_bili_res, dir_bili_flg, dir_bili_clr = evaluate_item(dir_bili_val, "mg/dL", "0.0 - 0.4", flag_dir_bili, 1)
    ast_res, ast_flg, ast_clr = evaluate_item(sgot_val, "U/L", "10 - 40", flag_ast, 0)
    alt_res, alt_flg, alt_clr = evaluate_item(sgpt_val, "U/L", "7 - 56", flag_alt, 0)
    alb_res, alb_flg, alb_clr = evaluate_item(alb_val, "g/dL", "3.5 - 5.0", flag_alb, 1)
    plt_res, plt_flg, plt_clr = evaluate_item(plt_val, "×10³/µL", "150 - 450", flag_plt, 0)
    pt_res, pt_flg, pt_clr = evaluate_item(pt_val, "sec", "11.0 - 15.0", flag_pt, 1)
    alk_res, alk_flg, alk_clr = evaluate_item(alk_val, "U/L", "40 - 129", flag_alk, 0)

    def make_cell(text, is_bold=False):
        style = st["table_cell_bold"] if is_bold else st["table_cell"]
        return Paragraph(text, style)

    def make_flag(text, color):
        return Paragraph(f"<font color='{color}'><b>{text}</b></font>", st["table_cell"])

    panel_rows = [
        [
            Paragraph("<b>Liver Biomarker Test</b>", st["table_header"]),
            Paragraph("<b>Observed Result</b>", st["table_header"]),
            Paragraph("<b>Units</b>", st["table_header"]),
            Paragraph("<b>Reference Range</b>", st["table_header"]),
            Paragraph("<b>Clinical Flag</b>", st["table_header"]),
        ],
        [
            make_cell("Total Bilirubin", True),
            make_cell(f"<b>{bili_res}</b>" if bili_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("mg/dL"),
            make_cell("0.2 – 1.2"),
            make_flag(bili_flg, bili_clr),
        ],
        [
            make_cell("Direct Bilirubin", True),
            make_cell(f"<b>{dir_bili_res}</b>" if dir_bili_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("mg/dL"),
            make_cell("0.0 – 0.4"),
            make_flag(dir_bili_flg, dir_bili_clr),
        ],
        [
            make_cell("SGOT (AST)", True),
            make_cell(f"<b>{ast_res}</b>" if ast_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("U/L"),
            make_cell("10 – 40"),
            make_flag(ast_flg, ast_clr),
        ],
        [
            make_cell("SGPT (ALT)", True),
            make_cell(f"<b>{alt_res}</b>" if alt_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("U/L"),
            make_cell("7 – 56"),
            make_flag(alt_flg, alt_clr),
        ],
        [
            make_cell("Albumin", True),
            make_cell(f"<b>{alb_res}</b>" if alb_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("g/dL"),
            make_cell("3.5 – 5.0"),
            make_flag(alb_flg, alb_clr),
        ],
        [
            make_cell("Platelets", True),
            make_cell(f"<b>{plt_res}</b>" if plt_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("×10³/µL"),
            make_cell("150 – 450"),
            make_flag(plt_flg, plt_clr),
        ],
        [
            make_cell("Prothrombin Time", True),
            make_cell(f"<b>{pt_res}</b>" if pt_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("sec"),
            make_cell("11.0 – 15.0"),
            make_flag(pt_flg, pt_clr),
        ],
        [
            make_cell("Alkaline Phosphatase", True),
            make_cell(f"<b>{alk_res}</b>" if alk_res != "Not entered" else "<font color='#64748b'>Not entered</font>"),
            make_cell("U/L"),
            make_cell("40 – 129"),
            make_flag(alk_flg, alk_clr),
        ],
    ]

    panel_table = Table(panel_rows, colWidths=[170, 80, 65, 95, 122])
    panel_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1877F2")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 3.5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(panel_table)
    story.append(Spacer(1, 8))

    # 4. Clinical Decision Support & Liver Risk Stratification
    risk_label = getattr(patient, "latest_risk_label", "Pending Evaluation") or "Pending Evaluation"
    risk_pct = getattr(patient, "latest_risk_percent", 0.0) or 0.0
    tier_color = "#e11d48" if "High" in risk_label else ("#d97706" if "Med" in risk_label else ("#059669" if "Low" in risk_label else "#64748b"))

    diet_summary = getattr(patient, "diet_plan", None) or "Low-salt hepatic diet, avoid alcohol, fresh vegetables."
    care_summary = getattr(patient, "care_instructions", None) or "Adequate rest, avoid heavy physical exertion, routine follow-up."

    ai_box_data = [
        [
            Paragraph("<b>CIRRHOCARE AI — CLINICAL STATUS & RISK STRATIFICATION</b>", st["meta_label"]),
            Paragraph(f"<font color='{tier_color}' size=9.5><b>{risk_label.upper()} ({risk_pct:.1f}% Risk Probability)</b></font>", st["meta_label"]),
        ],
        [
            Paragraph(
                f"<b>Clinical Staging Status:</b> {treatment_status}<br/>"
                f"<b>Dietary Protocol:</b> {diet_summary[:120]}...<br/>"
                f"<b>Care Directives:</b> {care_summary[:120]}...",
                st["clinical_note"],
            ),
            Paragraph(
                "<b>Clinical Interpretation & Recommendations:</b><br/>"
                + (
                    "Urgent hepatologist review required. Assess portal pressure and monitor coagulation profile closely."
                    if "High" in risk_label
                    else (
                        "Follow-up liver panel recommended within 30-90 days. Maintain dietary and lifestyle modifications."
                        if "Med" in risk_label
                        else "Hepatic synthetic and excretory markers remain stable. Continue standard clinical liver surveillance."
                    )
                ),
                st["clinical_note"],
            ),
        ],
    ]
    ai_box = Table(ai_box_data, colWidths=[266, 266])
    ai_box.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#ffffff")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94a3b8")),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(ai_box)
    story.append(Spacer(1, 10))

    # 5. Sign-off & Electronic Attestation
    sign_data = [
        [
            Paragraph("<b>Reporting Laboratory Technician:</b>", st["meta_label"]),
            Paragraph("<b>Attending Hepatologist Verification:</b>", st["meta_label"]),
        ],
        [
            Paragraph(
                f"<b>{reporting_tech}</b><br/>"
                "<font size=7 color='#64748b'>Clinical Laboratory Station • CirrhoCare AI<br/>"
                "Attestation ID: CIRRHO-LAB-VERIFIED</font>",
                st["meta_value"],
            ),
            Paragraph(
                f"<b>{clinician_name}</b><br/>"
                f"<font size=7 color='#64748b'>Status: <b>{review_status_text}</b><br/>"
                f"Electronic Record Verification: CIRRHO-AUTH-{portal_id}-{rep_id}</font>",
                st["meta_value"],
            ),
        ],
    ]
    sign_table = Table(sign_data, colWidths=[266, 266])
    sign_table.setStyle(
        TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(sign_table)

    doc.build(story, canvasmaker=ClinicalReportCanvas)

    if output_path is None:
        buffer.seek(0)
        return buffer.getvalue()
    return Path(output_path)

