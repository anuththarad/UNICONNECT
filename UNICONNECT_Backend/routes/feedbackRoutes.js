const express = require('express');
const router = express.Router();
const sql = require('mssql');
const poolPromise = require('../db');

// Submit feedback
router.post('/events/:eventId/feedback', async (req, res) => {
  try {
    console.log('Feedback route hit');
    console.log('Event ID:', req.params.eventId);
    console.log('Body:', req.body);

    const { eventId } = req.params;
    const { user_id, rating, comment } = req.body;

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required'
      });
    }

    const pool = await poolPromise;

    await pool.request()
      .input('user_id', sql.Int, user_id || null)
      .input('event_id', sql.Int, eventId)
      .input('rating', sql.Int, rating)
      .input('comments', sql.NVarChar(sql.MAX), comment || null)
      .query(`
        INSERT INTO Feedback
        (
          user_id,
          event_id,
          rating,
          comments,
          feedback_date
        )
        VALUES
        (
          @user_id,
          @event_id,
          @rating,
          @comments,
          GETDATE()
        )
      `);

    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });

  } catch (error) {
    console.error('FEEDBACK ERROR:', error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;