from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from threading import Lock


class HospitalStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._init_db()
        self._seed_doctors()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS doctors (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    specialty TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS appointments (
                    id TEXT PRIMARY KEY,
                    confirmation_code TEXT NOT NULL UNIQUE,
                    patient_name TEXT NOT NULL,
                    phone_number TEXT NOT NULL,
                    doctor_id TEXT NOT NULL,
                    specialty TEXT NOT NULL,
                    visit_date TEXT NOT NULL,
                    slot_time TEXT NOT NULL,
                    status TEXT NOT NULL,
                    idempotency_key TEXT UNIQUE,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
                );
                """
            )

    def _seed_doctors(self) -> None:
        with self._connect() as conn:
            count = conn.execute("SELECT COUNT(*) AS c FROM doctors").fetchone()["c"]
            if count > 0:
                return
            conn.executemany(
                "INSERT INTO doctors (id, name, specialty, active) VALUES (?, ?, ?, 1)",
                [
                    ("doc-cardio-001", "Dr. Kumar", "cardiology"),
                    ("doc-cardio-002", "Dr. Ravi", "cardiology"),
                    ("doc-ortho-001", "Dr. Meena", "orthopedics"),
                    ("doc-derma-001", "Dr. Priya", "dermatology"),
                    ("doc-general-001", "Dr. Arun", "general"),
                ],
            )

    def list_doctors(self, specialty: str | None = None) -> list[dict]:
        sql = "SELECT id, name, specialty FROM doctors WHERE active = 1"
        args: list[str] = []
        if specialty:
            sql += " AND lower(specialty) = ?"
            args.append(specialty.strip().lower())
        sql += " ORDER BY specialty, name"

        with self._connect() as conn:
            rows = conn.execute(sql, args).fetchall()
        return [dict(row) for row in rows]

    def get_available_slots(
        self,
        visit_date: str,
        specialty: str | None = None,
        doctor_id: str | None = None,
    ) -> dict:
        self._validate_date(visit_date)

        doctors = self.list_doctors(specialty)
        if doctor_id:
            doctors = [d for d in doctors if d["id"] == doctor_id]

        if not doctors:
            return {
                "ok": True,
                "visit_date": visit_date,
                "items": [],
                "message": "No matching doctors found.",
            }

        with self._connect() as conn:
            items: list[dict] = []
            for doctor in doctors:
                booked_rows = conn.execute(
                    """
                    SELECT slot_time
                    FROM appointments
                    WHERE doctor_id = ? AND visit_date = ? AND status = 'confirmed'
                    """,
                    (doctor["id"], visit_date),
                ).fetchall()
                booked = {row["slot_time"] for row in booked_rows}
                slots = [s for s in self._daily_slots() if s not in booked]
                items.append(
                    {
                        "doctor_id": doctor["id"],
                        "doctor_name": doctor["name"],
                        "specialty": doctor["specialty"],
                        "slots": slots,
                    }
                )

        return {"ok": True, "visit_date": visit_date, "items": items}

    def book_appointment(
        self,
        patient_name: str,
        phone_number: str,
        visit_date: str,
        slot_time: str,
        specialty: str | None = None,
        doctor_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        self._validate_date(visit_date)
        self._validate_slot(slot_time)

        with self._lock:
            with self._connect() as conn:
                if idempotency_key:
                    existing = conn.execute(
                        """
                        SELECT id, confirmation_code, patient_name, doctor_id, specialty, visit_date, slot_time, status
                        FROM appointments
                        WHERE idempotency_key = ?
                        """,
                        (idempotency_key,),
                    ).fetchone()
                    if existing:
                        row = dict(existing)
                        doctor = self._get_doctor(conn, row["doctor_id"])
                        return {
                            "ok": True,
                            "idempotent_replay": True,
                            "appointment_id": row["id"],
                            "confirmation_code": row["confirmation_code"],
                            "status": row["status"],
                            "patient_name": row["patient_name"],
                            "doctor_name": doctor["name"] if doctor else None,
                            "specialty": row["specialty"],
                            "visit_date": row["visit_date"],
                            "slot_time": row["slot_time"],
                        }

                selected_doctor = None
                doctors = self.list_doctors(specialty)
                if doctor_id:
                    doctors = [d for d in doctors if d["id"] == doctor_id]
                if doctors:
                    selected_doctor = doctors[0]

                if not selected_doctor:
                    return {"ok": False, "error": "No doctor found for requested criteria."}

                availability = self.get_available_slots(
                    visit_date=visit_date,
                    specialty=selected_doctor["specialty"],
                    doctor_id=selected_doctor["id"],
                )
                doctor_slots = availability["items"][0]["slots"] if availability["items"] else []
                if slot_time not in doctor_slots:
                    return {"ok": False, "error": "Selected slot is not available."}

                appointment_id = str(uuid.uuid4())
                confirmation_code = f"APT-{visit_date.replace('-', '')}-{uuid.uuid4().hex[:6].upper()}"
                now = datetime.utcnow().isoformat() + "Z"

                conn.execute(
                    """
                    INSERT INTO appointments
                    (id, confirmation_code, patient_name, phone_number, doctor_id, specialty, visit_date, slot_time, status, idempotency_key, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
                    """,
                    (
                        appointment_id,
                        confirmation_code,
                        patient_name.strip(),
                        phone_number.strip(),
                        selected_doctor["id"],
                        selected_doctor["specialty"],
                        visit_date,
                        slot_time,
                        idempotency_key,
                        now,
                    ),
                )

                return {
                    "ok": True,
                    "appointment_id": appointment_id,
                    "confirmation_code": confirmation_code,
                    "status": "confirmed",
                    "patient_name": patient_name.strip(),
                    "doctor_name": selected_doctor["name"],
                    "doctor_id": selected_doctor["id"],
                    "specialty": selected_doctor["specialty"],
                    "visit_date": visit_date,
                    "slot_time": slot_time,
                }

    def get_appointment_status(
        self,
        appointment_id: str | None = None,
        confirmation_code: str | None = None,
        phone_number: str | None = None,
        visit_date: str | None = None,
    ) -> dict:
        with self._connect() as conn:
            row = None
            if appointment_id:
                row = conn.execute(
                    "SELECT * FROM appointments WHERE id = ?",
                    (appointment_id.strip(),),
                ).fetchone()
            elif confirmation_code:
                row = conn.execute(
                    "SELECT * FROM appointments WHERE confirmation_code = ?",
                    (confirmation_code.strip(),),
                ).fetchone()
            elif phone_number and visit_date:
                self._validate_date(visit_date)
                row = conn.execute(
                    """
                    SELECT *
                    FROM appointments
                    WHERE phone_number = ? AND visit_date = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (phone_number.strip(), visit_date),
                ).fetchone()
            else:
                return {
                    "ok": False,
                    "error": "Provide appointment_id, confirmation_code, or (phone_number + visit_date).",
                }

            if not row:
                return {"ok": False, "error": "Appointment not found."}

            doctor = self._get_doctor(conn, row["doctor_id"])
            return {
                "ok": True,
                "appointment_id": row["id"],
                "confirmation_code": row["confirmation_code"],
                "status": row["status"],
                "patient_name": row["patient_name"],
                "phone_number": row["phone_number"],
                "doctor_id": row["doctor_id"],
                "doctor_name": doctor["name"] if doctor else None,
                "specialty": row["specialty"],
                "visit_date": row["visit_date"],
                "slot_time": row["slot_time"],
                "created_at": row["created_at"],
            }

    def verify_patient(
        self,
        phone_number: str,
        dob: str | None = None,
        mrn: str | None = None,
    ) -> dict:
        # Demo verification. Replace with real HMS/OTP check in production.
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT patient_name, phone_number, id, confirmation_code, visit_date
                FROM appointments
                WHERE phone_number = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (phone_number.strip(),),
            ).fetchone()
            if not row:
                return {"ok": False, "verified": False, "error": "Patient not found for this phone number."}
            return {
                "ok": True,
                "verified": True,
                "patient_name": row["patient_name"],
                "phone_number": row["phone_number"],
                "latest_appointment_id": row["id"],
                "latest_confirmation_code": row["confirmation_code"],
                "latest_visit_date": row["visit_date"],
                "note": "Demo verification by phone number. Use OTP/MRN+DOB in production.",
            }

    def execute_tool(self, tool_name: str, args: dict) -> dict:
        try:
            if tool_name == "verify_patient":
                return self.verify_patient(
                    phone_number=str(args.get("phone_number", "")).strip(),
                    dob=args.get("dob"),
                    mrn=args.get("mrn"),
                )

            if tool_name == "get_available_slots":
                return self.get_available_slots(
                    visit_date=str(args.get("visit_date", "")).strip(),
                    specialty=(str(args["specialty"]).strip().lower() if args.get("specialty") else None),
                    doctor_id=(str(args["doctor_id"]).strip() if args.get("doctor_id") else None),
                )

            if tool_name == "book_appointment":
                return self.book_appointment(
                    patient_name=str(args.get("patient_name", "")).strip(),
                    phone_number=str(args.get("phone_number", "")).strip(),
                    visit_date=str(args.get("visit_date", "")).strip(),
                    slot_time=str(args.get("slot_time", "")).strip(),
                    specialty=(str(args["specialty"]).strip().lower() if args.get("specialty") else None),
                    doctor_id=(str(args["doctor_id"]).strip() if args.get("doctor_id") else None),
                    idempotency_key=(str(args["idempotency_key"]).strip() if args.get("idempotency_key") else None),
                )

            if tool_name == "get_appointment_status":
                return self.get_appointment_status(
                    appointment_id=(str(args["appointment_id"]).strip() if args.get("appointment_id") else None),
                    confirmation_code=(str(args["confirmation_code"]).strip() if args.get("confirmation_code") else None),
                    phone_number=(str(args["phone_number"]).strip() if args.get("phone_number") else None),
                    visit_date=(str(args["visit_date"]).strip() if args.get("visit_date") else None),
                )

            return {"ok": False, "error": f"Unknown tool: {tool_name}"}
        except Exception as exc:
            return {"ok": False, "error": f"Tool execution failed: {exc}"}

    def _get_doctor(self, conn: sqlite3.Connection, doctor_id: str) -> dict | None:
        row = conn.execute(
            "SELECT id, name, specialty FROM doctors WHERE id = ?",
            (doctor_id,),
        ).fetchone()
        return dict(row) if row else None

    def _validate_date(self, visit_date: str) -> None:
        datetime.strptime(visit_date, "%Y-%m-%d")

    def _validate_slot(self, slot_time: str) -> None:
        datetime.strptime(slot_time, "%H:%M")

    def _daily_slots(self) -> list[str]:
        slots: list[str] = []
        for hour in range(9, 17):
            slots.append(f"{hour:02d}:00")
            slots.append(f"{hour:02d}:30")
        return slots
