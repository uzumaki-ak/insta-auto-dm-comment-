/**
 * Stats Component - COMPLETE
 */
import { useState, useEffect } from "react";
import { getOverallStats } from "../services/api";

function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      setError("");
      const response = await getOverallStats();
      setStats(response.stats);
    } catch (err) {
      console.error("Error loading stats:", err);
      setError("Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">{error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const dbStats = stats.database || {};
  const queueStats = stats.queue || {};

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-value">{dbStats.total_unique_users || 0}</span>
        <span className="stat-label">Unique Users</span>
      </div>

      <div className="stat-card">
        <span className="stat-value">{dbStats.total_replies || 0}</span>
        <span className="stat-label">Total Replies</span>
      </div>

      <div className="stat-card">
        <span className="stat-value">{dbStats.total_dms_sent || 0}</span>
        <span className="stat-label">DMs Sent</span>
      </div>

      <div className="stat-card">
        <span className="stat-value">{queueStats.waiting || 0}</span>
        <span className="stat-label">Queue Waiting</span>
      </div>

      <div className="stat-card">
        <span className="stat-value">{queueStats.active || 0}</span>
        <span className="stat-label">Queue Active</span>
      </div>

      <div className="stat-card">
        <span className="stat-value">{dbStats.active_posts || 0}</span>
        <span className="stat-label">Active Posts</span>
      </div>
    </div>
  );
}

export default Stats;
