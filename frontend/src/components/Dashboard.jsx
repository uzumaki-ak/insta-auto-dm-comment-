/**
 * Dashboard Component - COMPLETE
 */
import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import Stats from "./Stats";
import PostList from "./PostList";
import { getAllPosts, syncPosts } from "../services/api";

function Dashboard({ session }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getAllPosts();
      setPosts(response.posts || []);
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || err.message || "Failed to load posts";
      setError(errorMsg);
      console.error("Error loading posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError("");
      const response = await syncPosts();
      await loadPosts();
      alert(`Synced ${response.added || 0} new posts!`);
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || err.message || "Failed to sync posts";
      setError(errorMsg);
      console.error("Error syncing posts:", err);
      alert("Sync failed: " + errorMsg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <Navbar session={session} />

      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>Instagram Automation</h1>
            <p style={{ opacity: 0.7, marginTop: "10px" }}>
              Manage automated replies for your Instagram posts
            </p>
          </div>
          <div className="dashboard-actions">
            <button onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync Posts"}
            </button>
            <button
              onClick={loadPosts}
              className="secondary"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <Stats />

        {loading ? (
          <div className="loading">Loading posts...</div>
        ) : (
          <PostList posts={posts} onPostsChange={loadPosts} />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
