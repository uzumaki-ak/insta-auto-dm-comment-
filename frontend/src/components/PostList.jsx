import PostCard from "./PostCard";

function PostList({ posts, onPostsChange }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Posts Yet</h3>
        <p>Click "Sync Posts" to import your Instagram posts</p>
      </div>
    );
  }

  return (
    <div className="post-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onUpdate={onPostsChange} />
      ))}
    </div>
  );
}

export default PostList;
