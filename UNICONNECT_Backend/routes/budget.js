require("dotenv").config();

const express = require("express");
const sql = require("mssql");
const pool = require("../db");

const router = express.Router();

console.log("BUDGET ROUTER LOADED");

function decInput(val) {
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/* ─────────────────────────────────────────────────────────────
   GET  /organizer/:organizerId
   All events + budget items for the organizer dashboard
   Now returns: category, notes, image_url per budget row
───────────────────────────────────────────────────────────── */
router.get("/organizer/:organizerId", async (req, res) => {
  try {
    const organizerId = Number(req.params.organizerId);
    if (!organizerId) {
      return res.status(400).json({ success: false, message: "Invalid organizer ID" });
    }

    const request = pool.request();
    request.input("organizer_id", sql.Int, organizerId);

    const result = await request.query(`
      SELECT
        e.event_id,
        e.title,
        e.category,
        e.event_date,
        e.venue,
        e.capacity,
        e.organizer_id,
        e.image_url,
        b.budget_id,
        b.description,
        b.category        AS budget_category,
        b.notes,
        b.estimated_cost,
        b.actual_cost,
        b.created_at,
        b.updated_at
      FROM [Event] e
      LEFT JOIN Budget b ON e.event_id = b.event_id
      WHERE e.organizer_id = @organizer_id
      ORDER BY e.event_id DESC, b.budget_id DESC
    `);

    /* Remap budget_category → category so the frontend key is consistent */
    const rows = result.recordset.map(row => ({
      ...row,
      category: row.budget_category ?? row.category,
    }));

    return res.json({ success: true, data: { events: rows } });

  } catch (err) {
    console.error("GET ORGANIZER BUDGETS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET  /event/:eventId?organizer_id=
   All budget items for a single event
───────────────────────────────────────────────────────────── */
router.get("/event/:eventId", async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const organizerId = Number(req.query.organizer_id);

    if (!eventId || !organizerId) {
      return res.status(400).json({
        success: false,
        message: "event_id and organizer_id are required"
      });
    }

    const request = pool.request();
    request.input("event_id", sql.Int, eventId);
    request.input("organizer_id", sql.Int, organizerId);

    const result = await request.query(`
      SELECT
        b.budget_id,
        b.event_id,
        b.description,
        b.category,
        b.notes,
        b.estimated_cost,
        b.actual_cost,
        b.created_at,
        b.updated_at,
        b.priority,
        b.vendor,
        b.payment_status
      FROM Budget b
      INNER JOIN [Event] e ON b.event_id = e.event_id
      WHERE b.event_id    = @event_id
        AND e.organizer_id = @organizer_id
      ORDER BY b.budget_id DESC
    `);

    return res.json({ success: true, data: { budgets: result.recordset } });

  } catch (err) {
    console.error("GET EVENT BUDGET ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET  /analytics/:eventId?organizer_id=
   Aggregated analytics per category for charts & forecast
───────────────────────────────────────────────────────────── */
router.get("/analytics/:eventId", async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const organizerId = Number(req.query.organizer_id);

    if (!eventId || !organizerId) {
      return res.status(400).json({
        success: false,
        message: "event_id and organizer_id are required"
      });
    }

    const request = pool.request();
    request.input("event_id", sql.Int, eventId);
    request.input("organizer_id", sql.Int, organizerId);

    /* Summary totals */
    const summaryResult = await request.query(`
      SELECT
        COUNT(b.budget_id)                                     AS total_items,
        ISNULL(SUM(b.estimated_cost), 0)                       AS total_estimated,
        ISNULL(SUM(b.actual_cost), 0)                          AS total_actual,
        ISNULL(SUM(b.estimated_cost) - SUM(b.actual_cost), 0) AS balance,
        COUNT(CASE WHEN b.actual_cost > b.estimated_cost THEN 1 END) AS over_count,
        COUNT(CASE WHEN b.actual_cost < b.estimated_cost THEN 1 END) AS under_count,
        COUNT(CASE WHEN b.actual_cost = b.estimated_cost THEN 1 END) AS on_count,
        CASE
          WHEN SUM(b.estimated_cost) > 0
          THEN ROUND(SUM(b.actual_cost) * 100.0 / SUM(b.estimated_cost), 2)
          ELSE 0
        END AS spend_pct
      FROM Budget b
      INNER JOIN [Event] e ON b.event_id = e.event_id
      WHERE b.event_id    = @event_id
        AND e.organizer_id = @organizer_id
    `);

    /* Per-category breakdown */
    const request2 = pool.request();
    request2.input("event_id", sql.Int, eventId);
    request2.input("organizer_id", sql.Int, organizerId);

    const categoryResult = await request2.query(`
      SELECT
        ISNULL(b.category, 'Other')          AS category,
        COUNT(b.budget_id)                   AS item_count,
        ISNULL(SUM(b.estimated_cost), 0)     AS total_estimated,
        ISNULL(SUM(b.actual_cost), 0)        AS total_actual,
        CASE
          WHEN SUM(b.estimated_cost) > 0
          THEN ROUND(SUM(b.actual_cost) * 100.0 / SUM(b.estimated_cost), 2)
          ELSE 0
        END AS spend_pct
      FROM Budget b
      INNER JOIN [Event] e ON b.event_id = e.event_id
      WHERE b.event_id    = @event_id
        AND e.organizer_id = @organizer_id
      GROUP BY ISNULL(b.category, 'Other')
      ORDER BY total_actual DESC
    `);

    return res.json({
      success: true,
      data: {
        summary: summaryResult.recordset[0],
        categories: categoryResult.recordset
      }
    });

  } catch (err) {
    console.error("GET ANALYTICS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET  /summary/:organizerId
   Cross-event summary for the organizer overview page
───────────────────────────────────────────────────────────── */
router.get("/summary/:organizerId", async (req, res) => {
  try {
    const organizerId = Number(req.params.organizerId);
    if (!organizerId) {
      return res.status(400).json({ success: false, message: "Invalid organizer ID" });
    }

    const request = pool.request();
    request.input("organizer_id", sql.Int, organizerId);

    const result = await request.query(`
      SELECT
        e.event_id,
        e.title,
        e.event_date,
        e.category        AS event_category,
        COUNT(b.budget_id)                                     AS total_items,
        ISNULL(SUM(b.estimated_cost), 0)                       AS total_estimated,
        ISNULL(SUM(b.actual_cost), 0)                          AS total_actual,
        ISNULL(SUM(b.estimated_cost) - SUM(b.actual_cost), 0) AS balance,
        COUNT(CASE WHEN b.actual_cost > b.estimated_cost THEN 1 END) AS over_count,
        CASE
          WHEN SUM(b.estimated_cost) > 0
          THEN ROUND(SUM(b.actual_cost) * 100.0 / SUM(b.estimated_cost), 2)
          ELSE 0
        END AS spend_pct
      FROM [Event] e
      LEFT JOIN Budget b ON e.event_id = b.event_id
      WHERE e.organizer_id = @organizer_id
      GROUP BY e.event_id, e.title, e.event_date, e.category
      ORDER BY e.event_id DESC
    `);

    return res.json({ success: true, data: { events: result.recordset } });

  } catch (err) {
    console.error("GET SUMMARY ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }


});


router.post("/ai/budget-planner", async (req, res) => {
  console.log("AI planner route reached");

  try {
    const { prompt } = req.body;

    if (!prompt) {
      console.log("Missing prompt");
      return res.status(400).json({
        success: false,
        message: "Prompt is required"
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("Missing Anthropic API key");
      return res.status(500).json({
        success: false,
        message: "ANTHROPIC_API_KEY is missing"
      });
    }

    console.log("Calling Anthropic API...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    clearTimeout(timeout);

    console.log("Anthropic status:", aiResponse.status);

    const data = await aiResponse.json();
    console.log("Anthropic response received");

    if (!aiResponse.ok) {
      console.log("Anthropic error:", data);

      return res.status(aiResponse.status).json({
        success: false,
        message: data.error?.message || "Claude API request failed"
      });
    }

    const text = data.content
      ?.map(block => block.text || "")
      .join("")
      .trim();

    return res.json({
      success: true,
      text
    });

  } catch (err) {
    console.error("AI budget planner error:", err);

    return res.status(500).json({
      success: false,
      message: err.name === "AbortError"
        ? "Anthropic API request timed out"
        : err.message || "AI budget planner failed"
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      event_id,
      organizer_id,
      estimated_cost,
      actual_cost,
      description,
      category,
      notes,
      priority,
      vendor,
      payment_status
    } = req.body;

    if (!event_id || !organizer_id || !description) {
      return res.status(400).json({
        success: false,
        message: "event_id, organizer_id and description are required"
      });
    }

    /* Verify event belongs to organizer */
    const eventCheck = pool.request();
    eventCheck.input("event_id",      sql.Int, Number(event_id));
    eventCheck.input("organizer_id",  sql.Int, Number(organizer_id));

    const eventResult = await eventCheck.query(`
      SELECT event_id FROM [Event]
      WHERE event_id     = @event_id
        AND organizer_id = @organizer_id
    `);

    if (eventResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found for this organizer"
      });
    }

    const insertRequest = pool.request();
    insertRequest.input("event_id",        sql.Int,              Number(event_id));
    insertRequest.input("estimated_cost",  sql.Decimal(10, 2),   decInput(estimated_cost)  ?? 0);
    insertRequest.input("actual_cost",     sql.Decimal(10, 2),   decInput(actual_cost)     ?? 0);
    insertRequest.input("description",     sql.NVarChar(500),    description);
    insertRequest.input("category",        sql.NVarChar(100),    category       || "Other");
    insertRequest.input("notes",           sql.NVarChar(sql.MAX), notes         || null);
    insertRequest.input("priority",        sql.NVarChar(50),     priority       || "Medium");
    insertRequest.input("vendor",          sql.NVarChar(255),    vendor         || null);
    insertRequest.input("payment_status",  sql.NVarChar(50),     payment_status || "Unpaid");

    const result = await insertRequest.query(`
      INSERT INTO Budget
        (event_id, estimated_cost, actual_cost, description, category, notes,
         priority, vendor, payment_status)
      OUTPUT INSERTED.*
      VALUES
        (@event_id, @estimated_cost, @actual_cost, @description, @category, @notes,
         @priority, @vendor, @payment_status)
    `);

    return res.status(201).json({
      success: true,
      message: "Budget item added successfully",
      data: { budget: result.recordset[0] }
    });

  } catch (err) {
    console.error("CREATE BUDGET ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});


/* ─────────────────────────────────────────────────────────────
   PUT  /:id?  (organizer_id in body)
   Update a budget item
───────────────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const budgetId = Number(req.params.id);
    const {
      organizer_id,
      description,
      category,
      estimated_cost,
      actual_cost,
      notes,
      priority,
      vendor,
      payment_status
    } = req.body;

    if (!budgetId || !organizer_id) {
      return res.status(400).json({
        success: false,
        message: "budget_id and organizer_id are required"
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "description is required"
      });
    }

    const request = pool.request();
    request.input("budget_id",      sql.Int,             budgetId);
    request.input("organizer_id",   sql.Int,             Number(organizer_id));
    request.input("description",    sql.NVarChar(500),   description);
    request.input("category",       sql.NVarChar(100),   category       || "Other");
    request.input("estimated_cost", sql.Decimal(10, 2),  decInput(estimated_cost) ?? 0);
    request.input("actual_cost",    sql.Decimal(10, 2),  decInput(actual_cost)    ?? 0);
    request.input("notes",          sql.NVarChar(sql.MAX), notes        || null);
    request.input("priority",       sql.NVarChar(50),    priority       || "medium");
    request.input("vendor",         sql.NVarChar(255),   vendor         || null);
    request.input("payment_status", sql.NVarChar(50),    payment_status || "pending");

    const result = await request.query(`
      UPDATE b
      SET
        b.description    = @description,
        b.category       = @category,
        b.estimated_cost = @estimated_cost,
        b.actual_cost    = @actual_cost,
        b.notes          = @notes,
        b.priority       = @priority,
        b.vendor         = @vendor,
        b.payment_status = @payment_status,
        b.updated_at     = GETDATE()
      FROM Budget b
      INNER JOIN [Event] e ON b.event_id = e.event_id
      WHERE b.budget_id    = @budget_id
        AND e.organizer_id = @organizer_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Budget item not found or does not belong to this organizer"
      });
    }

    /* Return the updated row */
    const fetchRequest = pool.request();
    fetchRequest.input("budget_id", sql.Int, budgetId);
    const updated = await fetchRequest.query(`
      SELECT * FROM Budget WHERE budget_id = @budget_id
    `);

    return res.json({
      success: true,
      message: "Budget item updated successfully",
      data: { budget: updated.recordset[0] }
    });

  } catch (err) {
    console.error("UPDATE BUDGET ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE  /:id?organizer_id=
   Delete a budget item (unchanged, kept secure via JOIN)
───────────────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const budgetId   = Number(req.params.id);
    const organizerId = Number(req.query.organizer_id);

    if (!budgetId || !organizerId) {
      return res.status(400).json({
        success: false,
        message: "budget_id and organizer_id are required"
      });
    }

    const request = pool.request();
    request.input("budget_id",    sql.Int, budgetId);
    request.input("organizer_id", sql.Int, organizerId);

    const result = await request.query(`
      DELETE b
      FROM Budget b
      INNER JOIN [Event] e ON b.event_id = e.event_id
      WHERE b.budget_id   = @budget_id
        AND e.organizer_id = @organizer_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Budget item not found for this organizer"
      });
    }

    return res.json({ success: true, message: "Budget item deleted successfully" });

  } catch (err) {
    console.error("DELETE BUDGET ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});



module.exports = router;

