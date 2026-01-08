/**
 * PostCard Component - COMPLETE
 */
import { useState } from 'react';
import KeywordForm from './KeywordForm';
import { togglePostActive, deleteKeyword, getPostById } from '../services/api';

function PostCard({ post, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [showKeywordForm, setShowKeywordForm] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [postDetails, setPostDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !postDetails) {
      try {
        setLoading(true);
        const response = await getPostById(post.id);
        setPostDetails(response.post);
      } catch (err) {
        console.error('Error loading post details:', err);
        alert('Failed to load post details');
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  const handleToggle = async () => {
    try {
      setToggling(true);
      await togglePostActive(post.id, !post.is_active);
      onUpdate();
    } catch (err) {
      alert('Failed to toggle post: ' + (err.response?.data?.error || err.message));
      console.error('Error toggling post:', err);
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteKeyword = async (keywordId) => {
    if (!confirm('Delete this keyword?')) return;

    try {
      await deleteKeyword(keywordId);
      const response = await getPostById(post.id);
      setPostDetails(response.post);
      onUpdate();
    } catch (err) {
      alert('Failed to delete keyword: ' + (err.response?.data?.error || err.message));
      console.error('Error deleting keyword:', err);
    }
  };

  const handleKeywordAdded = async () => {
    setShowKeywordForm(false);
    try {
      const response = await getPostById(post.id);
      setPostDetails(response.post);
      onUpdate();
    } catch (err) {
      console.error('Error reloading post:', err);
    }
  };

  const displayPost = postDetails || post;
  const keywords = displayPost.keywords || [];

  return (
    <div className="post-card">
      <div className="post-thumbnail">
        {post.media_url ? (
          <img src={post.media_url} alt="Post" />
        ) : (
          <span>{post.media_type}</span>
        )}
      </div>

      <div className="post-content">
        <span className={`status-badge ${post.is_active ? 'status-active' : 'status-inactive'}`}>
          {post.is_active ? 'Active' : 'Inactive'}
        </span>

        <div className="post-meta">
          <span>{post.media_type}</span>
          <span>{post.keyword_count || 0} Keywords</span>
          <span>{post.replies_count || 0} Replies</span>
        </div>

        {post.caption && (
          <p className="post-caption">{post.caption}</p>
        )}

        {expanded && (
          <>
            {loading && (
              <div style={{ padding: '20px', textAlign: 'center', opacity: 0.7 }}>
                Loading details...
              </div>
            )}

            {!loading && keywords.length > 0 && (
              <div className="keywords-list">
                {keywords.map((kw) => (
                  <div key={kw.id} className="keyword-badge">
                    "{kw.keyword}"
                    <button
                      onClick={() => handleDeleteKeyword(kw.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#000',
                        marginLeft: '8px',
                        padding: '0',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}
                      title="Delete keyword"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!loading && showKeywordForm && (
              <KeywordForm
                postId={post.id}
                onSuccess={handleKeywordAdded}
                onCancel={() => setShowKeywordForm(false)}
              />
            )}

            {!loading && !showKeywordForm && (
              <button
                onClick={() => setShowKeywordForm(true)}
                className="secondary"
                style={{ marginTop: '15px' }}
              >
                + Add Keyword
              </button>
            )}
          </>
        )}
      </div>

      <div className="post-actions">
        <button onClick={handleExpand} disabled={loading}>
          {expanded ? 'Hide' : 'Manage'}
        </button>

        <button
          onClick={handleToggle}
          disabled={toggling}
          className={post.is_active ? 'danger' : 'secondary'}
        >
          {toggling ? '...' : (post.is_active ? 'Disable' : 'Enable')}
        </button>

        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <button className="secondary">View Post</button>
          </a>
        )}
      </div>
    </div>
  );
}

export default PostCard;