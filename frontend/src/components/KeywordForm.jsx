/**
 * KeywordForm Component - COMPLETE
 */
import { useState } from 'react';
import { addKeyword } from '../services/api';

function KeywordForm({ postId, onSuccess, onCancel }) {
  const [keyword, setKeyword] = useState('');
  const [commentReply, setCommentReply] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate
    if (!keyword.trim() || !commentReply.trim()) {
      setError('Keyword and comment reply are required');
      return;
    }

    if (commentReply.length > 2200) {
      setError('Comment reply too long (max 2200 characters)');
      return;
    }

    if (dmMessage && dmMessage.length > 1000) {
      setError('DM message too long (max 1000 characters)');
      return;
    }

    try {
      setLoading(true);
      await addKeyword(postId, {
        keyword: keyword.trim(),
        case_sensitive: caseSensitive,
        comment_reply: commentReply.trim(),
        dm_message: dmMessage.trim() || null
      });
      onSuccess();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to add keyword';
      setError(errorMsg);
      console.error('Error adding keyword:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="keyword-form-container">
      <h3>Add Keyword Trigger</h3>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="keyword-form">
        <div className="form-group">
          <label>Keyword (e.g., "link", "price", "dm")</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="link"
            required
            disabled={loading}
            maxLength={255}
          />
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="caseSensitive"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            disabled={loading}
          />
          <label htmlFor="caseSensitive" style={{ marginBottom: 0 }}>
            Case Sensitive
          </label>
        </div>

        <div className="form-group">
          <label>Comment Reply (public, visible to everyone)</label>
          <textarea
            value={commentReply}
            onChange={(e) => setCommentReply(e.target.value)}
            placeholder="Check your DM! 👀"
            required
            disabled={loading}
            maxLength={2200}
          />
          <small style={{ opacity: 0.6, fontSize: '11px' }}>
            {commentReply.length}/2200 characters
          </small>
        </div>

        <div className="form-group">
          <label>DM Message (optional, private)</label>
          <textarea
            value={dmMessage}
            onChange={(e) => setDmMessage(e.target.value)}
            placeholder="Here's the link: https://..."
            disabled={loading}
            maxLength={1000}
          />
          <small style={{ opacity: 0.6, fontSize: '11px' }}>
            {dmMessage.length}/1000 characters (leave empty to skip DM)
          </small>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Keyword'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default KeywordForm;