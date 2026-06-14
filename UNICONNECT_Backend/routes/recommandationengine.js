/**
 * UniConnect – Intelligent Event Recommendation Engine
 * =====================================================
 * Stack : Node.js + Express.js + mssql (Microsoft SQL Server)
 *
 * Algorithm: Hybrid scoring (weighted sum of four signals)
 *  1. Interest Match     – event category matches user's registered interests
 *  2. Engagement Score   – events similar to ones the user attended/rated highly
 *  3. Popularity Score   – registration count normalised across active events
 *  4. Recency Boost      – upcoming events get a time-decay boost
 *
 * Signals are each normalised to [0, 1] then combined:
 *   score = 0.40 * interestMatch
 *         + 0.30 * engagementSimilarity
 *         + 0.20 * popularity
 *         + 0.10 * recencyBoost
 */

const express = require('express');
const sql = require('mssql');
const router = express.Router();

// ─── Shared DB pool (injected from app.js) ──────────────────────────────────
let pool;
const setPool = (p) => { pool = p; };

// ─── Weight constants ────────────────────────────────────────────────────────
const W = {
  INTEREST:    0.40,
  ENGAGEMENT:  0.30,
  POPULARITY:  0.20,
  RECENCY:     0.10,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise an array of numbers to [0, 1] */
function normalise(arr) {
  const max = Math.max(...arr, 1);
  return arr.map(v => v / max);
}

/** Days between today and event_date (negative = past) */
function daysFromNow(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return diff / (1000 * 60 * 60 * 24);
}

/** Recency boost: peaks at 1 for events 7 days out, decays for further/past */
function recencyScore(dateStr) {
  const d = daysFromNow(dateStr);
  if (d < 0) return 0;                  // past events: no boost
  if (d <= 7) return 1;                 // very soon: max boost
  return Math.max(0, 1 - (d - 7) / 90); // decay over 90 days
}

// ─── Core recommendation function ────────────────────────────────────────────

/**
 * getRecommendations(userId, limit)
 * Returns an array of recommended events sorted by score descending.
 */
async function getRecommendations(userId, limit = 10) {
  // 1. Fetch user's registered interests (interest_name values)
  const interestResult = await pool.request()
    .input('uid', sql.Int, userId)
    .query(`
      SELECT i.interest_name
      FROM   dbo.User_Interest ui
      JOIN   dbo.Interest      i  ON i.interest_id = ui.interest_id
      WHERE  ui.user_id = @uid
    `);
  const userInterests = interestResult.recordset.map(r => r.interest_name.toLowerCase());

  // 2. Fetch categories of events the user has already registered for
  //    and their average feedback rating per category → engagement signal
  const engagementResult = await pool.request()
    .input('uid', sql.Int, userId)
    .query(`
      SELECT   e.category,
               COUNT(*)          AS reg_count,
               AVG(f.rating + 0.0) AS avg_rating
      FROM     dbo.Participant_Registration pr
      JOIN     dbo.Event    e ON e.event_id = pr.event_id
      LEFT JOIN dbo.Feedback f ON f.event_id = pr.event_id
                               AND f.user_id  = pr.user_id
      WHERE    pr.user_id = @uid
      GROUP BY e.category
    `);

  // category → weighted engagement score map
  const engagementMap = {};
  for (const row of engagementResult.recordset) {
    const cat = (row.category || 'Other').toLowerCase();
    // combine registration count and rating (rating wins if present)
    const score = (row.avg_rating ?? 3) * row.reg_count;
    engagementMap[cat] = (engagementMap[cat] || 0) + score;
  }
  const maxEngagement = Math.max(...Object.values(engagementMap), 1);

  // 3. Fetch all upcoming public events the user has NOT registered for
  const eventsResult = await pool.request()
    .input('uid', sql.Int, userId)
    .query(`
      SELECT   e.event_id,
               e.title,
               e.description,
               e.category,
               e.event_date,
               e.venue,
               e.start_time,
               e.end_time,
               e.image_url,
               e.capacity,
               e.allow_ticket_booking,
               COUNT(pr.registration_id) AS registration_count
      FROM     dbo.Event e
      LEFT JOIN dbo.Participant_Registration pr
             ON pr.event_id = e.event_id
      WHERE    e.visibility = 'Public'
        AND    e.event_date >= CAST(GETDATE() AS DATE)
        AND    e.event_id NOT IN (
                 SELECT event_id
                 FROM   dbo.Participant_Registration
                 WHERE  user_id = @uid
               )
      GROUP BY e.event_id, e.title, e.description, e.category,
               e.event_date, e.venue, e.start_time, e.end_time,
               e.image_url, e.capacity, e.allow_ticket_booking
      ORDER BY e.event_date ASC
    `);

  const events = eventsResult.recordset;
  if (!events.length) return [];

  // 4. Compute normalised popularity across retrieved events
  const regCounts    = events.map(e => e.registration_count);
  const normPop      = normalise(regCounts);

  // 5. Score each event
  const scored = events.map((e, idx) => {
    const cat = (e.category || 'Other').toLowerCase();

    // Interest match: 1 if category is in user interests, else 0
    // Partial match: category word appears inside any interest or vice-versa
    const interestMatch = userInterests.some(
      i => i.includes(cat) || cat.includes(i)
    ) ? 1 : 0;

    // Engagement similarity: normalised past-behaviour score for this category
    const engSim = ((engagementMap[cat] || 0) / maxEngagement);

    // Popularity (already normalised)
    const pop = normPop[idx];

    // Recency boost
    const recency = recencyScore(e.event_date);

    const totalScore =
      W.INTEREST   * interestMatch +
      W.ENGAGEMENT * engSim +
      W.POPULARITY * pop +
      W.RECENCY    * recency;

    return {
      ...e,
      _score:          +totalScore.toFixed(4),
      _interestMatch:  interestMatch,
      _engagementSim:  +engSim.toFixed(4),
      _popularity:     +pop.toFixed(4),
      _recency:        +recency.toFixed(4),
      _reason:         buildReason(interestMatch, engSim, recency, userInterests, cat),
    };
  });

  // 6. Sort by score descending, return top N
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}

/** Human-readable explanation for why an event is recommended */
function buildReason(interestMatch, engSim, recency, userInterests, cat) {
  const reasons = [];
  if (interestMatch > 0)  reasons.push(`Matches your interest in "${cat}"`);
  if (engSim > 0.3)       reasons.push('Similar to events you enjoyed before');
  if (recency > 0.8)      reasons.push('Coming up very soon');
  if (!reasons.length)    reasons.push('Popular on campus right now');
  return reasons.join(' · ');
}

// ─── Express Routes ───────────────────────────────────────────────────────────

/**
 * GET /api/recommendations/:userId
 * Query params: limit (default 10)
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit  = parseInt(req.query.limit) || 10;

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const recommendations = await getRecommendations(userId, limit);
    res.json({ success: true, count: recommendations.length, recommendations });
  } catch (err) {
    console.error('[Recommendation Engine]', err);
    res.status(500).json({ success: false, message: 'Failed to load recommendations' });
  }
});

/**
 * GET /api/recommendations/:userId/interests
 * Returns the user's current registered interests — useful for the frontend
 * to show "Your interests" chips.
 */
router.get('/:userId/interests', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const result = await pool.request()
      .input('uid', sql.Int, userId)
      .query(`
        SELECT i.interest_id, i.interest_name
        FROM   dbo.User_Interest ui
        JOIN   dbo.Interest i ON i.interest_id = ui.interest_id
        WHERE  ui.user_id = @uid
        ORDER BY i.interest_name
      `);
    res.json({ success: true, interests: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load interests' });
  }
});

/**
 * PUT /api/recommendations/:userId/interests
 * Body: { interestIds: [1, 4, 7] }
 * Replaces user's interest list (upsert pattern).
 */
router.put('/:userId/interests', async (req, res) => {
  try {
    const userId      = parseInt(req.params.userId);
    const { interestIds } = req.body;

    if (!Array.isArray(interestIds)) {
      return res.status(400).json({ success: false, message: 'interestIds must be an array' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Clear existing
      await transaction.request()
        .input('uid', sql.Int, userId)
        .query(`DELETE FROM dbo.User_Interest WHERE user_id = @uid`);

      // Insert new
      for (const id of interestIds) {
        await transaction.request()
          .input('uid', sql.Int, userId)
          .input('iid', sql.Int, id)
          .query(`INSERT INTO dbo.User_Interest (user_id, interest_id) VALUES (@uid, @iid)`);
      }
      await transaction.commit();
      res.json({ success: true, message: 'Interests updated' });
    } catch (inner) {
      await transaction.rollback();
      throw inner;
    }
  } catch (err) {
    console.error('[Interests Update]', err);
    res.status(500).json({ success: false, message: 'Failed to update interests' });
  }
});

module.exports = { router, setPool };