"""

app.utils.clinical_seed

------------------------

Safely provisions a verified, comprehensive baseline synthetic clinical dataset

for CirrhoCare AI clinical demonstration and dashboard evaluation.

Guarantees:

1. Hard idempotence: Only populates when the patients table is empty (count == 0).

   If real patient records exist, it strictly does not overwrite, delete, or reset them.

2. Realistic clinical profiles: 8 diverse patients with distinct clinical statuses,

   comprehensive liver biomarkers, calculated AI risk scores via Random Forest,

   prescriptions, appointments, activity logs, notifications, and valid diagnostic PDFs.

3. Unified across all clinical roles:

   - Doctor Dashboard displays all patients, lab results, prescriptions, and advice.

   - Lab Tech Dashboard displays patients, biomarker entry, report upload, and workflow statuses.

   - Admin Dashboard displays live counts, analytics, audit logs, and monitoring tables.

   - Patient Portal displays PAT-1001's personalized reports, appointments, and care advice.

"""

from datetime import datetime, timedelta, timezone

from pathlib import Path

from app.models import db

from app.models.activity_log import ActivityLog

from app.models.appointment import Appointment

from app.models.notification import Notification

from app.models.patient import Patient

from app.models.prediction import Prediction

from app.models.prescription import Prescription

from app.models.report import Report

from app.models.user import User

def seed_baseline_clinical_data(app=None):

    """

    Safely seeds the baseline clinical dataset if the patient table is empty.

    Returns a dictionary of execution status and row counts.

    """

    from flask import current_app

    target_app = app or current_app

    if not target_app:

        return {"status": "no_app_context", "seeded": 0}

    # 1. Idempotency Check: Never overwrite or re-seed if patients already exist

    existing_patient_count = Patient.query.count()

    if existing_patient_count > 0:

        return {

            "status": "skipped_existing_data",

            "patients": existing_patient_count,

            "message": f"Database already contains {existing_patient_count} patient record(s). Seeding skipped.",

        }

    print("[CirrhoCare AI] Initializing baseline synthetic clinical dataset...")

    # 2. Ensure baseline clinical staff & demo patient user accounts exist

    def get_or_create_user(name, email, role, password, portal_id=None):

        u = User.query.filter_by(email=email).first()

        if not u and portal_id:

            u = User.query.filter_by(portal_id=portal_id).first()

        if not u:

            u = User(

                name=name,

                email=email,

                role=role,

                portal_id=portal_id,

                active=True,

                must_change_password=False,

            )

            u.set_password(password)

            db.session.add(u)

            db.session.flush()

        else:

            if portal_id and not u.portal_id:

                u.portal_id = portal_id

                db.session.flush()

        return u

    admin = get_or_create_user("System Admin", "admin@careai.com", "admin", "Admin@123")

    doctor = get_or_create_user("Dr. Hepato Care", "doctor@careai.com", "hepatologist", "Doctor@123")

    labtech = get_or_create_user("Lab Technician", "lab@careai.com", "labtech", "Lab@123")

    patient_user = get_or_create_user("Eleanor Vance [DEMO]", "patient@careai.com", "patient", "Patient@123", "PAT-1001")

    krishna_user = get_or_create_user("Krishna Singh", "krishna.singh@careai.com", "patient", "Patient@123", "CC-2026-5817")

    db.session.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    today = now.date()

    # 3. Eight Fictional Synthetic Patients with realistic biomarkers & clinical status

    patients_data = [

        {

            "portal_id": "PAT-1001",

            "full_name": "Eleanor Vance [DEMO]",

            "email": "eleanor.demo@fictional.care",

            "phone": "+1-555-0101",

            "age": 58,

            "gender": "Female",

            "bilirubin": 4.6,

            "direct_bilirubin": 2.2,

            "albumin": 2.5,

            "sgot": 88.0,

            "sgpt": 74.0,

            "platelets": 92.0,

            "cholesterol": 240.0,

            "prothrombin": 14.8,

            "ascites": True,

            "hepatomegaly": True,

            "spiders": False,

            "edema": False,

            "copper": 98.0,

            "alk_phos": 145.0,

            "triglycerides": 195.0,

            "treatment_status": "Under Treatment",

            "lab_workflow_status": "Completed",

            "diet_plan": "Recommended: Low-sodium (< 2.0g NaCl / day), high-quality vegetable protein (1.2-1.5 g/kg/day), antioxidant-rich berries, steamed leafy greens, oats, walnuts.\n\nAvoid: Processed meats, canned soups, frozen ready-meals, alcohol, unpasteurized dairy, raw shellfish.\n\nMeals: 5-6 small, nutrient-dense meals throughout the day with a high-protein evening snack (e.g., greek yogurt or unsalted nut butter).",

            "care_instructions": "Rest: Daily 30-minute afternoon rest period with elevated legs. Limit strenuous physical exertion during active ascites.\n\nCare: Monitor and record daily morning dry weight. Report sudden weight gain (>1 kg over 48 hours) or increased abdominal distension immediately. Follow fluid restriction to 1.5 L/day.",

            "follow_up_date": today + timedelta(days=14),

            "created_at": now - timedelta(days=150),

        },

        {

            "portal_id": "PAT-1002",

            "full_name": "Marcus Holloway [DEMO]",

            "email": "marcus.demo@fictional.care",

            "phone": "+1-555-0102",

            "age": 49,

            "gender": "Male",

            "bilirubin": 2.4,

            "direct_bilirubin": 1.1,

            "albumin": 3.2,

            "sgot": 61.0,

            "sgpt": 52.0,

            "platelets": 138.0,

            "cholesterol": 215.0,

            "prothrombin": 12.6,

            "ascites": False,

            "hepatomegaly": True,

            "spiders": True,

            "edema": False,

            "copper": 82.0,

            "alk_phos": 115.0,

            "triglycerides": 165.0,

            "treatment_status": "Under Treatment",

            "lab_workflow_status": "Report Uploaded",

            "diet_plan": "Recommended: Mediterranean dietary pattern, extra virgin olive oil, fatty fish (salmon, mackerel), legumes, fiber.\n\nAvoid: Refined sugars, saturated fats, sodas, alcohol.\n\nMeals: Balanced plate method: half plate non-starchy vegetables, quarter whole grains, quarter lean protein.",

            "care_instructions": "Rest: Regular mild-to-moderate aerobic exercise (walking 30 mins 4 days/week).\n\nCare: Blood pressure checks every 2 weeks. Avoid NSAIDs (ibuprofen, naproxen). Use acetaminophen sparingly only under clinical guidance.",

            "follow_up_date": today + timedelta(days=21),

            "created_at": now - timedelta(days=120),

        },

        {

            "portal_id": "PAT-1003",

            "full_name": "Sophia Chen [DEMO]",

            "email": "sophia.demo@fictional.care",

            "phone": "+1-555-0103",

            "age": 36,

            "gender": "Female",

            "bilirubin": 0.9,

            "direct_bilirubin": 0.3,

            "albumin": 4.1,

            "sgot": 22.0,

            "sgpt": 24.0,

            "platelets": 245.0,

            "cholesterol": 180.0,

            "prothrombin": 11.2,

            "ascites": False,

            "hepatomegaly": False,

            "spiders": False,

            "edema": False,

            "copper": 65.0,

            "alk_phos": 72.0,

            "triglycerides": 110.0,

            "treatment_status": "Follow-up Required",

            "lab_workflow_status": "Completed",

            "diet_plan": "Recommended: Whole-food plant-forward nutrition, cruciferous vegetables, green tea, lean poultry, chia seeds.\n\nAvoid: High-fructose corn syrup, ultra-processed snack foods.\n\nMeals: 3 balanced meals daily with adequate hydration (2.0-2.5 L water daily).",

            "care_instructions": "Rest: Maintain active lifestyle (150 minutes moderate cardiovascular exercise weekly).\n\nCare: Annual routine hepatic ultrasound and liver panel surveillance.",

            "follow_up_date": today + timedelta(days=60),

            "created_at": now - timedelta(days=90),

        },

        {

            "portal_id": "PAT-1004",

            "full_name": "Arthur Pendelton [DEMO]",

            "email": "arthur.demo@fictional.care",

            "phone": "+1-555-0104",

            "age": 67,

            "gender": "Male",

            "bilirubin": 5.1,

            "direct_bilirubin": 2.8,

            "albumin": 2.2,

            "sgot": 96.0,

            "sgpt": 82.0,

            "platelets": 81.0,

            "cholesterol": 260.0,

            "prothrombin": 15.4,

            "ascites": True,

            "hepatomegaly": True,

            "spiders": True,

            "edema": True,

            "copper": 115.0,

            "alk_phos": 168.0,

            "triglycerides": 210.0,

            "treatment_status": "Awaiting Doctor Review",

            "lab_workflow_status": "Report Uploaded",

            "diet_plan": "Recommended: Sodium restriction (< 1.5g daily). High-calorie, high-protein supplements as tolerated. Vegetable protein emphasized to manage encephalopathy risk.\n\nAvoid: Table salt, cured meats, bakery items with baking powder/soda, alcohol.\n\nMeals: Frequent nutrient-dense mini-meals.",

            "care_instructions": "Rest: Bed rest with leg elevation to mobilize dependent edema. Avoid heavy lifting or Valsalva maneuvers.\n\nCare: Urgent gastroenterology / hepatology follow-up. Monitor mental status daily for early signs of asterixis or disorientation.",

            "follow_up_date": today + timedelta(days=7),

            "created_at": now - timedelta(days=60),

        },

        {

            "portal_id": "PAT-1005",

            "full_name": "David Kim [DEMO]",

            "email": "david.demo@fictional.care",

            "phone": "+1-555-0105",

            "age": 42,

            "gender": "Male",

            "bilirubin": 1.8,

            "direct_bilirubin": 0.7,

            "albumin": 3.5,

            "sgot": 44.0,

            "sgpt": 39.0,

            "platelets": 165.0,

            "cholesterol": 225.0,

            "prothrombin": 12.1,

            "ascites": False,

            "hepatomegaly": True,

            "spiders": False,

            "edema": False,

            "copper": 78.0,

            "alk_phos": 98.0,

            "triglycerides": 175.0,

            "treatment_status": "Awaiting Doctor Review",

            "lab_workflow_status": "Test In Progress",

            "diet_plan": "Recommended: Low-glycemic, antioxidant-rich foods, avocado, leafy greens, walnuts, green tea.\n\nAvoid: Sweetened beverages, fast food, trans fats.\n\nMeals: Regular meals with controlled portions.",

            "care_instructions": "Rest: Regular brisk walking 4-5 times per week.\n\nCare: Repeat liver function tests in 6 weeks.",

            "follow_up_date": today + timedelta(days=30),

            "created_at": now - timedelta(days=35),

        },

        {

            "portal_id": "PAT-1006",

            "full_name": "Grace Hopper [DEMO]",

            "email": "grace.demo@fictional.care",

            "phone": "+1-555-0106",

            "age": 27,

            "gender": "Female",

            "bilirubin": 0.8,

            "direct_bilirubin": 0.2,

            "albumin": 4.3,

            "sgot": 19.0,

            "sgpt": 21.0,

            "platelets": 260.0,

            "cholesterol": 165.0,

            "prothrombin": 10.9,

            "ascites": False,

            "hepatomegaly": False,

            "spiders": False,

            "edema": False,

            "copper": 58.0,

            "alk_phos": 65.0,

            "triglycerides": 95.0,

            "treatment_status": "Awaiting Doctor Review",

            "lab_workflow_status": "Registered",

            "follow_up_date": today + timedelta(days=90),

            "created_at": now - timedelta(days=20),

        },

        {

            "portal_id": "PAT-1007",

            "full_name": "Robert Martinez [DEMO]",

            "email": "robert.demo@fictional.care",

            "phone": "+1-555-0107",

            "age": 53,

            "gender": "Male",

            "bilirubin": 1.1,

            "direct_bilirubin": 0.4,

            "albumin": 3.9,

            "sgot": 26.0,

            "sgpt": 28.0,

            "platelets": 210.0,

            "cholesterol": 195.0,

            "prothrombin": 11.5,

            "ascites": False,

            "hepatomegaly": False,

            "spiders": False,

            "edema": False,

            "copper": 70.0,

            "alk_phos": 82.0,

            "triglycerides": 130.0,

            "treatment_status": "Treatment Completed",

            "treatment_completed_notes": "Completed 6-month clinical management protocol. Liver enzymes normalized, platelets stable, elastography shows early stage reversal.",

            "treatment_completed_at": now - timedelta(days=5),

            "treatment_completed_by_id": doctor.id,

            "lab_workflow_status": "Completed",

            "follow_up_date": today + timedelta(days=90),

            "created_at": now - timedelta(days=10),

        },

        {

            "portal_id": "PAT-1008",

            "full_name": "Aisha Patel [DEMO]",

            "email": "aisha.demo@fictional.care",

            "phone": "+1-555-0108",

            "age": 44,

            "gender": "Female",

            "bilirubin": 2.1,

            "direct_bilirubin": 0.9,

            "albumin": 3.3,

            "sgot": 52.0,

            "sgpt": 48.0,

            "platelets": 150.0,

            "cholesterol": 210.0,

            "prothrombin": 12.4,

            "ascites": False,

            "hepatomegaly": True,

            "spiders": False,

            "edema": False,

            "copper": 85.0,

            "alk_phos": 108.0,

            "triglycerides": 160.0,

            "treatment_status": "Follow-up Required",

            "lab_workflow_status": "Report Uploaded",

            "diet_plan": "Recommended: High-fiber diet, legumes, steamed vegetables, citrus fruits, adequate fluids.\n\nAvoid: Heavy sedatives, excessive animal protein, alcohol.\n\nMeals: Small frequent meals.",

            "care_instructions": "Rest: Regular adequate sleep (7-8 hours nightly).\n\nCare: Monitor cognitive alertness and bowel regularity (target 2-3 soft movements daily).",

            "follow_up_date": today + timedelta(days=14),

            "created_at": now - timedelta(days=2),

        },

        {

            "portal_id": "CC-2026-5817",

            "full_name": "Krishna Singh",

            "email": "krishna.singh@careai.com",

            "phone": "+91-98765-43210",

            "age": 45,

            "gender": "Male",

            "bilirubin": 0.8,

            "direct_bilirubin": 0.3,

            "albumin": 4.1,

            "sgot": 32.0,

            "sgpt": 28.0,

            "platelets": 210.0,

            "cholesterol": 185.0,

            "prothrombin": 11.2,

            "ascites": False,

            "hepatomegaly": False,

            "spiders": False,

            "edema": False,

            "copper": 45.0,

            "alk_phos": 75.0,

            "triglycerides": 130.0,

            "treatment_status": "Treatment Completed",

            "lab_workflow_status": "Completed",

            "diet_plan": "Recommended: Balanced low-salt diet, regular hydration (8-10 glasses water daily), fresh seasonal fruits, leafy greens.\n\nAvoid: Fried oily foods, excess red meat, packaged snacks, alcohol.\n\nMeals: Regular nutritious meals at fixed hours.",

            "care_instructions": "Rest: 7-8 hours restful sleep. 30 minutes daily moderate walking.\n\nCare: Attend periodic routine follow-ups. Report any fatigue or jaundice immediately.",

            "follow_up_date": today + timedelta(days=60),

            "created_at": now - timedelta(days=1),

        },

    ]

    # Calculate Random Forest predictions using existing trained model

    from app.ml_model.predictor import predict_probability

    patient_instances = {}

    predictions_to_add = []

    for pdata in patients_data:

        p = Patient(

            portal_id=pdata["portal_id"],

            full_name=pdata["full_name"],

            email=pdata["email"],

            phone=pdata["phone"],

            age=pdata["age"],

            gender=pdata["gender"],

            bilirubin=pdata["bilirubin"],

            direct_bilirubin=pdata.get("direct_bilirubin"),

            albumin=pdata["albumin"],

            sgot=pdata["sgot"],

            sgpt=pdata["sgpt"],

            platelets=pdata["platelets"],

            cholesterol=pdata["cholesterol"],

            prothrombin=pdata["prothrombin"],

            ascites=pdata["ascites"],

            hepatomegaly=pdata["hepatomegaly"],

            spiders=pdata["spiders"],

            edema=pdata["edema"],

            copper=pdata.get("copper"),

            alk_phos=pdata.get("alk_phos"),

            triglycerides=pdata.get("triglycerides"),

            treatment_status=pdata["treatment_status"],

            lab_workflow_status=pdata.get("lab_workflow_status", "Registered"),

            diet_plan=pdata.get("diet_plan"),

            care_instructions=pdata.get("care_instructions"),

            follow_up_date=pdata.get("follow_up_date"),

            treatment_completed_notes=pdata.get("treatment_completed_notes"),

            treatment_completed_at=pdata.get("treatment_completed_at"),

            treatment_completed_by_id=pdata.get("treatment_completed_by_id"),

            assigned_doctor_id=doctor.id,

            created_by_id=doctor.id,

            created_at=pdata["created_at"],

            updated_at=pdata["created_at"],

        )

        try:

            pred_res = predict_probability({

                "age": p.age,

                "gender": p.gender,

                "bilirubin": p.bilirubin,

                "albumin": p.albumin,

                "sgot": p.sgot,

                "sgpt": p.sgpt,

                "platelets": p.platelets,

                "cholesterol": p.cholesterol,

                "prothrombin": p.prothrombin,

                "ascites": p.ascites,

                "hepatomegaly": p.hepatomegaly,

                "spiders": p.spiders,

                "edema": p.edema,

                "copper": p.copper,

                "alk_phos": p.alk_phos,

                "triglycerides": p.triglycerides,

            })

            p.latest_risk_percent = pred_res["probability"]

            p.latest_risk_label = pred_res["risk_label"]

            pred_conf = pred_res["confidence"]

        except Exception as e:

            print(f"[CirrhoCare AI] Warning: AI prediction calculation error: {e}. Using fallback.")

            p.latest_risk_percent = 50.0

            p.latest_risk_label = "Medium Risk"

            pred_conf = 75.0

        db.session.add(p)

        db.session.flush()

        patient_instances[p.portal_id] = p

        predictions_to_add.append(

            Prediction(

                patient_id=p.id,

                probability=round(p.latest_risk_percent / 100.0, 4),

                risk_label=p.latest_risk_label,

                confidence=round(pred_conf, 2),

                model_name="RandomForest",

                created_at=p.created_at,

            )

        )

    db.session.add_all(predictions_to_add)

    # 4. Realistic Appointments

    appointments = [

        Appointment(

            patient_id=patient_instances["PAT-1001"].id,

            doctor_id=doctor.id,

            scheduled_at=now + timedelta(days=2, hours=10),

            status="Confirmed",

            reason="[DEMO] Urgent decompensated cirrhosis evaluation & ascites management",

            created_at=now - timedelta(days=2),

        ),

        Appointment(

            patient_id=patient_instances["PAT-1002"].id,

            doctor_id=doctor.id,

            scheduled_at=now + timedelta(days=4, hours=14),

            status="Rescheduled",

            reason="[DEMO] 6-month hepatocellular surveillance & portal hypertension review",

            created_at=now - timedelta(days=4),

        ),

        Appointment(

            patient_id=patient_instances["PAT-1005"].id,

            doctor_id=doctor.id,

            scheduled_at=now - timedelta(days=3),

            status="Completed",

            reason="[DEMO] Initial liver biopsy & biomarker baseline assessment",

            doctor_notes="Biomarker baseline reviewed. Initiating UDCA and lifestyle modifications.",

            created_at=now - timedelta(days=7),

        ),

        Appointment(

            patient_id=patient_instances["PAT-1004"].id,

            doctor_id=doctor.id,

            scheduled_at=now - timedelta(days=1),

            status="Cancelled",

            reason="[DEMO] Patient requested appointment cancellation due to conflicting schedule",

            doctor_notes="Patient called to cancel. Will rebook once ascites improves.",

            created_at=now - timedelta(days=5),

        ),

    ]

    db.session.add_all(appointments)

    # 5. Realistic Prescriptions across diverse medication classes

    from app.utils.demo_prescriptions import get_demo_prescriptions_data

    rx_specs = get_demo_prescriptions_data(now)

    prescriptions = []

    for item in rx_specs:

        pt = patient_instances.get(item["patient_portal_id"])

        if pt:

            prescriptions.append(

                Prescription(

                    patient_id=pt.id,

                    doctor_id=doctor.id,

                    medicine=item["medicine"],

                    dosage=item["dosage"],

                    frequency_days=item["frequency_days"],

                    clinical_notes=item["clinical_notes"],

                    diet_suggestion=item["diet_suggestion"],

                    follow_up_date=item["follow_up_date"],

                    created_at=item["created_at"],

                )

            )

    db.session.add_all(prescriptions)

    # 6. Realistic Diagnostic Reports & Physical ReportLab PDFs

    reports_data = [

        {

            "portal_id": "PAT-1001",

            "filename": "demo_eleanor_comprehensive_metabolic_panel.pdf",

            "original_filename": "Comprehensive_Metabolic_Panel.pdf",

            "category": "Lab report",

            "uploaded_at": now - timedelta(days=15),

        },

        {

            "portal_id": "PAT-1002",

            "filename": "demo_marcus_abdominal_ultrasound.pdf",

            "original_filename": "Abdominal_Doppler_Ultrasound.pdf",

            "category": "Ultrasound",

            "uploaded_at": now - timedelta(days=12),

        },

        {

            "portal_id": "PAT-1005",

            "filename": "demo_david_liver_biopsy_histology.pdf",

            "original_filename": "Liver_Biopsy_Histology.pdf",

            "category": "Biopsy",

            "uploaded_at": now - timedelta(days=8),

        },

        {

            "portal_id": "PAT-1003",

            "filename": "demo_sophia_hepatic_function_panel.pdf",

            "original_filename": "Hepatic_Function_Panel.pdf",

            "category": "Lab report",

            "uploaded_at": now - timedelta(days=6),

        },

        {

            "portal_id": "PAT-1004",

            "filename": "demo_arthur_fibroscan_elastography.pdf",

            "original_filename": "FibroScan_Transient_Elastography.pdf",

            "category": "Ultrasound",

            "uploaded_at": now - timedelta(days=4),

        },

        {

            "portal_id": "PAT-1008",

            "filename": "demo_aisha_coagulation_profile.pdf",

            "original_filename": "Coagulation_Prothrombin_Profile.pdf",

            "category": "Lab report",

            "uploaded_at": now - timedelta(days=1),

        },

        {

            "portal_id": "CC-2026-5817",

            "filename": "demo_krishna_liver_function_test.pdf",

            "original_filename": "Liver_Function_Test.pdf",

            "category": "Lab report",

            "uploaded_at": now - timedelta(days=1),

        },

    ]

    from app.utils.demo_reports import generate_demo_report_pdf

    upload_dir = Path(target_app.config.get("UPLOAD_FOLDER", Path(target_app.instance_path) / "uploads")).resolve()

    demo_dir = Path(target_app.config.get("DEMO_UPLOAD_FOLDER", Path(target_app.instance_path) / "demo_uploads")).resolve()

    upload_dir.mkdir(parents=True, exist_ok=True)

    demo_dir.mkdir(parents=True, exist_ok=True)

    reports = []

    for rdata in reports_data:

        pt = patient_instances.get(rdata["portal_id"])

        if pt:

            rep = Report(

                patient_id=pt.id,

                filename=rdata["filename"],

                original_filename=rdata["original_filename"],

                category=rdata["category"],

                uploaded_at=rdata["uploaded_at"],

            )

            db.session.add(rep)

            reports.append((rep, pt, rdata["filename"]))

    db.session.flush()

    for rep, pt, fname in reports:

        try:

            generate_demo_report_pdf(rep, pt, upload_dir / fname)

            generate_demo_report_pdf(rep, pt, demo_dir / fname)

        except Exception as e:

            print(f"[CirrhoCare AI] Warning: Failed to generate PDF for {fname}: {e}")

    # 7. Activity Logs

    logs = [

        ActivityLog(user_id=labtech.id, action="New lab report uploaded", details="New lab report uploaded for Aisha Patel", created_at=now - timedelta(hours=2)),

        ActivityLog(user_id=doctor.id, action="Prescription added", details="Prescription added for Marcus Holloway", created_at=now - timedelta(hours=5)),

        ActivityLog(user_id=admin.id, action="New patient registered", details="New patient registered Grace Hopper", created_at=now - timedelta(days=1)),

        ActivityLog(user_id=labtech.id, action="Test result updated", details="Test result updated for Krishna Singh", created_at=now - timedelta(days=1)),

        ActivityLog(user_id=admin.id, action="New patient registered", details="Patient Eleanor Vance (PAT-1001) registered via clinical intake", created_at=now - timedelta(days=2)),

        ActivityLog(user_id=doctor.id, action="Clinical review completed", details="AI risk stratification (High Risk) confirmed for PAT-1001", created_at=now - timedelta(days=2)),

    ]

    db.session.add_all(logs)

    # 8. Notifications

    notifs = [

        Notification(

            role="admin",

            title="[DEMO] High-Risk Cirrhosis Patient Admitted",

            message="Patient Eleanor Vance (PAT-1001) classified as High Risk. Urgent triage scheduled.",

            read=False,

            category="alert",

            created_at=now - timedelta(hours=3),

        ),

        Notification(

            role="admin",

            title="[DEMO] Routine System Health Verified",

            message="All diagnostic model checkpoints and database connection pools verified healthy.",

            read=True,

            category="system",

            created_at=now - timedelta(days=1),

        ),

    ]

    db.session.add_all(notifs)

    db.session.commit()

    print(f"[CirrhoCare AI] Baseline clinical dataset successfully seeded: {len(patient_instances)} patients created.")

    return {

        "status": "success",

        "patients": len(patient_instances),

        "predictions": len(predictions_to_add),

        "appointments": len(appointments),

        "prescriptions": len(prescriptions),

        "reports": len(reports),

    }

def ensure_baseline_krishna_patient(app=None):

    """

    Safely ensures that patient Krishna Singh (portal_id: CC-2026-5817) and associated

    records (user account, baseline LFT report, prescription, activity log) exist.

    Completely idempotent: if Krishna Singh already exists, does not modify anything.

    """

    from flask import current_app

    from pathlib import Path

    target_app = app or current_app

    if not target_app:

        return None

    # Check if Krishna Singh already exists by portal_id or name

    existing = Patient.query.filter(

        (Patient.portal_id == "CC-2026-5817") |

        (Patient.full_name.ilike("%Krishna Singh%"))

    ).first()

    if existing:

        return existing

    print("[CirrhoCare AI] Provisioning baseline record for Krishna Singh (CC-2026-5817)...")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    today = now.date()

    # Find doctor or fallback to first hepatologist/admin

    doctor = User.query.filter_by(role="hepatologist").first()

    if not doctor:

        doctor = User.query.filter_by(role="admin").first()

    labtech = User.query.filter_by(role="labtech").first()

    admin = User.query.filter_by(role="admin").first()

    p = Patient(

        portal_id="CC-2026-5817",

        full_name="Krishna Singh",

        email="krishna.singh@careai.com",

        phone="+91-98765-43210",

        age=45,

        gender="Male",

        bilirubin=0.8,

        direct_bilirubin=0.3,

        albumin=4.1,

        sgot=32.0,

        sgpt=28.0,

        platelets=210.0,

        cholesterol=185.0,

        prothrombin=11.2,

        ascites=False,

        hepatomegaly=False,

        spiders=False,

        edema=False,

        copper=45.0,

        alk_phos=75.0,

        triglycerides=130.0,

        treatment_status="Treatment Completed",

        lab_workflow_status="Completed",

        latest_risk_percent=52.8,

        latest_risk_label="Medium Risk",

        diet_plan="Recommended: Balanced, low-salt diet, regular hydration (8-10 glasses water daily), fresh seasonal fruits, leafy greens.\n\nAvoid: Fried oily foods, excess red meat, packaged snacks, alcohol.\n\nMeals: Regular nutritious meals at fixed hours.",

        care_instructions="Rest: 7-8 hours restful sleep. 30 minutes daily moderate walking.\n\nCare: Attend periodic routine follow-ups. Report any fatigue or jaundice immediately.",

        follow_up_date=today + timedelta(days=60),

        assigned_doctor_id=doctor.id if doctor else None,

        created_at=now - timedelta(days=1),

    )

    db.session.add(p)

    db.session.flush()

    # User account for Krishna Singh

    user = User.query.filter_by(email="krishna.singh@careai.com").first()

    if not user:

        user = User(

            name="Krishna Singh",

            email="krishna.singh@careai.com",

            role="patient",

            portal_id="CC-2026-5817",

            active=True,

            must_change_password=False,

        )

        user.set_password("Patient@123")

        db.session.add(user)

        db.session.flush()

    # Prescription

    if doctor:

        rx = Prescription(patient_id=p.id,

            doctor_id=doctor.id,

            medicine="Ursodeoxycholic Acid (UDCA)",

            dosage="300mg PO twice daily with meals",

            frequency_days=60,

            clinical_notes="Maintenance hepatoprotective therapy following clinical recovery. Normal LFT profile.",

            diet_suggestion="Balanced low-salt diet, regular hydration (8-10 glasses water daily).",

            follow_up_date=today + timedelta(days=60),

            created_at=now - timedelta(days=2),

        )

        db.session.add(rx)

    # Diagnostic Report & PDF

    upload_dir = Path(target_app.config.get("UPLOAD_FOLDER", Path(target_app.instance_path) / "uploads")).resolve()

    upload_dir.mkdir(parents=True, exist_ok=True)

    fname = "demo_krishna_liver_function_test.pdf"

    rep = Report(

        patient_id=p.id,

        filename=fname,

        original_filename="Liver_Function_Test.pdf",

        category="Lab report",

        uploaded_at=now - timedelta(days=1),

    )

    db.session.add(rep)

    db.session.flush()

    try:

        from app.utils.demo_reports import generate_demo_report_pdf

        generate_demo_report_pdf(rep, p, upload_dir / fname)

    except Exception as e:

        print(f"[CirrhoCare AI] Warning: PDF gen for Krishna failed: {e}")

    # Activity log

    if labtech:

        db.session.add(ActivityLog(

            user_id=labtech.id,

            action="Test result updated",

            details="Test result updated for Krishna Singh",

            created_at=now - timedelta(days=1),

        ))

    db.session.commit()

    print("[CirrhoCare AI] Krishna Singh successfully provisioned.")

    return p
