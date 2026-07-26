import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { clientServer } from '@/config';
import Card from '@/Components/ui/Card';
import Skeleton from '@/Components/ui/Skeleton';
import EmptyState from '@/Components/ui/EmptyState';
import ReportMenu from '@/Components/ReportMenu';

export default function SharedPost() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    clientServer.get(`/post/${id}`)
      .then((res) => setData(res.data))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <EmptyState title="Post not found" description="This post may have been removed." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Skeleton rows={1} />
      </div>
    );
  }

  const { post, comments } = data;

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <img src={post.userId?.profilePicture} alt="" className="size-10 rounded-full object-cover" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{post.userId?.name}</p>
            <p className="text-xs text-neutral-500">@{post.userId?.username}</p>
          </div>
          <ReportMenu targetType="post" targetId={post._id} />
        </div>
        <p className="text-neutral-800 whitespace-pre-wrap mb-3">{post.body}</p>
        {post.media && (
          <img src={post.media} alt="" className="w-full rounded-md mb-3 object-cover" />
        )}
        <p className="text-xs text-neutral-500">
          {post.likeCount} like{post.likeCount === 1 ? '' : 's'} · {comments.length} comment{comments.length === 1 ? '' : 's'}
        </p>
      </Card>

      {comments.length > 0 && (
        <Card className="mt-4 divide-y divide-neutral-200">
          {comments.map((c) => (
            <div key={c._id} className="py-3 px-4">
              <p className="text-sm font-medium">{c.userId?.name}</p>
              <p className="text-sm text-neutral-700">{c.body}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
