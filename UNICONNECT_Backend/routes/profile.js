const express = require("express");
const router = express.Router();
const sql = require("mssql");
const bcrypt = require("bcrypt");
const pool = require("../db");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const authMiddleware = require('../middleware/authMiddleware');
const { switchLanguage } = require('../controllers/languageSwitchController');
const { applyLocale } = require('../middleware/languageController');
router.post('/settings/language', authMiddleware, applyLocale, switchLanguage);

/* =====================================================
UPLOAD FOLDER
===================================================== */

const uploadDir = "uploads/";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

/* =====================================================
MULTER
===================================================== */

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

/* =====================================================
GET USER PROFILE
===================================================== */

router.get("/:user_id", async (req, res) => {

    try {

        const user_id = Number(req.params.user_id);

        if (isNaN(user_id)) {
            return res.json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const conn = await pool;

        const result = await conn.request()
            .input("user_id", sql.Int, user_id)
            .query(`
                SELECT TOP 1 *
                FROM Users
                WHERE user_id = @user_id
            `);

        if (!result.recordset.length) {

            return res.json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (err) {

        console.log("GET USER ERROR:", err);

        return res.json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
GET USER EVENTS
===================================================== */

router.get("/:user_id/events", async (req, res) => {

    try {

        const user_id = Number(req.params.user_id);

        const conn = await pool;

        const result = await conn.request()
            .input("user_id", sql.Int, user_id)
            .query(`
                SELECT *
                FROM Event
                WHERE organizer_id = @user_id
                ORDER BY created_at DESC
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {

        console.log("EVENT ERROR:", err);

        return res.json({
            success: false,
            message: err.message
        });
    }
});

/* =====================================================
UPDATE PROFILE
===================================================== */

router.put("/:user_id", upload.single("profile_image"), async (req, res) => {

    try {

        const user_id = Number(req.params.user_id);

        const {
            full_name,
            email,
            contact_number,
            university,
            department_name,
            profile_bio,
            password
        } = req.body;

        const conn = await pool;

        let query = `
            UPDATE Users
            SET
                full_name = @full_name,
                email = @email,
                contact_number = @contact_number,
                university = @university,
                department_name = @department_name,
                Profile_bio = @profile_bio
        `;

        const request = conn.request()

            .input("user_id", sql.Int, user_id)

            .input("full_name", sql.NVarChar, full_name || "")

            .input("email", sql.NVarChar, email || "")

            .input("contact_number", sql.NVarChar, contact_number || "")

            .input("university", sql.NVarChar, university || "")

            .input("department_name", sql.NVarChar, department_name || "")

            .input("profile_bio", sql.NVarChar, profile_bio || "");

        /* ================= IMAGE ================= */

        if (req.file) {

            const imagePath = `/uploads/${req.file.filename}`;

            query += `,
                profile_image = @profile_image
            `;

            request.input(
                "profile_image",
                sql.NVarChar,
                imagePath
            );
        }

        /* ================= PASSWORD ================= */

        if (password && password.trim() !== "") {

            const hashedPassword = await bcrypt.hash(password, 10);

            query += `,
                password = @password
            `;

            request.input(
                "password",
                sql.NVarChar,
                hashedPassword
            );
        }

        query += `
            WHERE user_id = @user_id
        `;

        await request.query(query);

        return res.json({
            success: true,
            message: "Profile updated successfully"
        });

    } catch (err) {

        console.log("UPDATE ERROR:", err);

        return res.json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;