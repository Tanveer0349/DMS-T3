"use client";

import { useState } from "react";
import { MessageSquare, Reply, Edit2, Trash2, Send, User, Clock, MoreVertical } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/components/providers/toast-provider";
import { formatDate } from "~/lib/utils";
import { api } from "~/trpc/react";

interface Comment {
  id: string;
  documentId: string;
  parentCommentId: string | null;
  content: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentCommentsProps {
  documentId: string;
  documentName: string;
  isAdmin?: boolean;
  canComment?: boolean;
}

export function DocumentComments({ 
  documentId, 
  documentName, 
  isAdmin = false,
  canComment = true 
}: DocumentCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showComments, setShowComments] = useState(false);
  const { addToast } = useToast();

  // Queries
  const { data: comments, refetch: refetchComments } = isAdmin 
    ? api.admin.getDocumentComments.useQuery({ documentId }, { enabled: showComments })
    : api.user.getDocumentComments.useQuery({ documentId }, { enabled: showComments });

  // Mutations
  const createCommentMutation = isAdmin
    ? api.admin.createComment.useMutation()
    : api.user.createComment.useMutation();

  const updateCommentMutation = isAdmin
    ? api.admin.updateComment.useMutation()
    : api.user.updateComment.useMutation();

  const deleteCommentMutation = isAdmin
    ? api.admin.deleteComment.useMutation()
    : api.user.deleteComment.useMutation();

  // Helper function to organize comments into threads
  const organizeComments = (comments: Comment[]) => {
    const commentMap = new Map<string, Comment & { replies: Comment[] }>();
    const rootComments: (Comment & { replies: Comment[] })[] = [];

    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into threads
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const handleCreateComment = async (content: string, parentCommentId?: string) => {
    if (!content.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        documentId,
        content: content.trim(),
        parentCommentId,
      });

      if (parentCommentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }

      await refetchComments();
      
      addToast({
        type: "success",
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    } catch (error) {
      console.error("Failed to create comment:", error);
      addToast({
        type: "error",
        title: "Failed to post comment",
        description: "Please try again.",
      });
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    if (!content.trim()) return;

    try {
      await updateCommentMutation.mutateAsync({
        commentId,
        content: content.trim(),
      });

      setEditingComment(null);
      setEditContent("");
      await refetchComments();
      
      addToast({
        type: "success",
        title: "Comment updated",
        description: "Your comment has been updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update comment:", error);
      addToast({
        type: "error",
        title: "Failed to update comment",
        description: "Please try again.",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync({ commentId });
      await refetchComments();
      
      addToast({
        type: "success",
        title: "Comment deleted",
        description: "The comment has been deleted successfully.",
      });
    } catch (error) {
      console.error("Failed to delete comment:", error);
      addToast({
        type: "error",
        title: "Failed to delete comment",
        description: "Please try again.",
      });
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditContent("");
  };

  const startReplying = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyContent("");
  };

  const cancelReplying = () => {
    setReplyingTo(null);
    setReplyContent("");
  };

  const renderComment = (comment: Comment & { replies?: Comment[] }, isReply = false) => (
    <div key={comment.id} className={`${isReply ? "ml-8 mt-4" : ""}`}>
      <div className="border rounded-lg p-4 space-y-3">
        {/* Comment Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {comment.authorName || comment.authorEmail}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDate(comment.createdAt)}</span>
                {comment.isEdited && (
                  <Badge variant="secondary" className="text-xs">
                    Edited
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Comment Actions */}
          <div className="flex items-center gap-1">
            {canComment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startReplying(comment.id)}
                className="text-xs"
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
            
            {/* Edit/Delete for comment author or admin */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditing(comment)}
                className="text-xs"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteComment(comment.id)}
                className="text-xs text-destructive hover:text-destructive"
                disabled={deleteCommentMutation.isPending}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Comment Content */}
        <div className="ml-10">
          {editingComment === comment.id ? (
            <div className="space-y-2">
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Edit your comment..."
                className="w-full"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleUpdateComment(comment.id, editContent)}
                  disabled={updateCommentMutation.isPending || !editContent.trim()}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>

        {/* Reply Input */}
        {replyingTo === comment.id && (
          <div className="ml-10 space-y-2 pt-2 border-t">
            <Input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="w-full"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleCreateComment(replyContent, comment.id)}
                disabled={createCommentMutation.isPending || !replyContent.trim()}
              >
                <Send className="h-3 w-3 mr-1" />
                Reply
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelReplying}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Render Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-4">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  const organizedComments = comments ? organizeComments(comments) : [];

  return (
    <div className="space-y-4">
      {/* Comments Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments?.length || 0})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? "Hide Comments" : "Show Comments"}
        </Button>
      </div>

      {showComments && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Discussion for "{documentName}"
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Comment Input */}
            {canComment && (
              <div className="space-y-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full"
                />
                <Button
                  onClick={() => handleCreateComment(newComment)}
                  disabled={createCommentMutation.isPending || !newComment.trim()}
                  className="w-full sm:w-auto"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post Comment
                </Button>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {organizedComments.length > 0 ? (
                organizedComments.map(comment => renderComment(comment))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No comments yet.</p>
                  {canComment && (
                    <p className="text-sm">Be the first to start the discussion!</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
