import React, { useState, useEffect, useContext, useRef } from 'react';
import { publishUnreadTotal } from '../hooks/useUnreadMessages';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import Avatar from '../components/ui/Avatar';
import { ArrowLeft } from 'lucide-react';

/**
 * `embedded` renders the chat to fill its parent (used inside the Freelancer /
 * Company dashboard main content area). Without it the component keeps its
 * original standalone full-page framing for the /messages route.
 */
const Messages = ({ embedded = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  // Explains WHICH side is missing a subscription (comes from the backend).
  const [lockDetails, setLockDetails] = useState(null);
  // Mobile only: which of the two panels is showing.
  const [mobileView, setMobileView] = useState('list');
  const messagesEndRef = useRef(null);
  const [initialSelectDone, setInitialSelectDone] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && !initialSelectDone) {
      const activeId = location.state?.activeConversationId;
      if (activeId) {
        const convToSelect = conversations.find(c => c.id === activeId || c._id === activeId);
        if (convToSelect) {
          selectConversation(convToSelect);
        }
      }
      setInitialSelectDone(true);
    }
  }, [conversations, initialSelectDone, location.state]);

  useEffect(() => {
    if (socket) {
      socket.on('receive_message', (message) => {
        const msgConvId = String(message.conversation_id || message.conversationId);
        const activeConvId = String(activeConv?._id || activeConv?.id);

        if (activeConv && msgConvId === activeConvId) {
          setMessages(prev => {
            if (prev.find(m => (m._id || m.id) === (message._id || message.id))) return prev;
            return [...prev, message];
          });
          scrollToBottom();
          // Already on screen: clear it server-side so the badge never appears
          // and the read state survives a refresh.
          markConversationRead(msgConvId);
        }
        fetchConversations();
      });

      // Conversation-scoped unread update. The server sends an absolute count,
      // so duplicate events or a reconnect cannot double-count.
      socket.on('conversation_unread', ({ conversationId, unreadCount }) => {
        const activeConvId = String(activeConv?._id || activeConv?.id);

        if (activeConv && String(conversationId) === activeConvId) {
          markConversationRead(conversationId);
          return;
        }

        setConversations(prev =>
          prev.map(c =>
            String(c.id || c._id) === String(conversationId)
              ? { ...c, unread_count: unreadCount }
              : c
          )
        );
      });

      socket.on('error', (err) => {
        setError(err);
      });

      return () => {
        socket.off('receive_message');
        socket.off('conversation_unread');
        socket.off('error');
      };
    }
  }, [socket, activeConv]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/api/chat/conversations');
      
      const getValidId = (obj) => {
        if (!obj) return null;
        if (typeof obj === 'string') return obj;
        if (typeof obj === 'object') return String(obj._id || obj.id || '');
        return String(obj);
      };

      const userIdStr = String(user.id || user._id);
      
      // Deduplicate based on the other user's ID
      const uniqueChatsMap = new Map();
      
      res.data.forEach(conv => {
        const companyId = getValidId(conv.company_id);
        const freelancerId = getValidId(conv.freelancer_id);
        
        let otherUserId = null;
        if (companyId === userIdStr) {
          otherUserId = freelancerId;
        } else {
          otherUserId = companyId;
        }

        // Only add if we haven't seen this user, OR if this conversation has a newer last_message_at
        if (otherUserId) {
          if (!uniqueChatsMap.has(otherUserId)) {
            uniqueChatsMap.set(otherUserId, conv);
          } else {
            const existingConv = uniqueChatsMap.get(otherUserId);
            const existingDate = existingConv.last_message_at ? new Date(existingConv.last_message_at) : new Date(0);
            const newDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(0);
            if (newDate > existingDate) {
               uniqueChatsMap.set(otherUserId, conv);
            }
          }
        }
      });

      setConversations(Array.from(uniqueChatsMap.values()));
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403 && err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setIsLocked(true);
      } else {
        setError('Failed to load conversations.');
      }
    }
  };

  /**
   * Clears unread state for ONE conversation, server-side.
   * Optimistically zeroes the local badge so the UI responds immediately.
   */
  const markConversationRead = async (conversationId) => {
    if (!conversationId) return;
    setConversations(prev =>
      prev.map(c =>
        String(c.id || c._id) === String(conversationId) ? { ...c, unread_count: 0 } : c
      )
    );
    try {
      const res = await api.patch(`/api/chat/conversations/${conversationId}/read`);
      // The same response carries the new grand total, so the sidebar badge
      // updates from one round-trip instead of a second request.
      publishUnreadTotal(res.data?.total_unread);
    } catch (err) {
      // Non-fatal: the next conversations fetch restores the true count.
      console.error('Failed to mark conversation as read', err);
    }
  };

  const selectConversation = async (conv) => {
    setIsLocked(false);
    setLockDetails(null);
    setError('');
    setActiveConv(conv);
    setMobileView('chat');
    const convId = conv.id || conv._id;
    if (socket) {
      socket.emit('join_conversation', convId);
    }
    try {
      const res = await api.get(`/api/chat/conversations/${convId}/messages`);
      setMessages(res.data);
      scrollToBottom();
      // Opening the conversation clears only this conversation's unread badge.
      markConversationRead(convId);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403 && err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setIsLocked(true);
        setLockDetails(err.response.data.details || null);
      } else {
        setError(err.response?.data?.message || 'Failed to load messages.');
      }
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || !socket) return;

    const convId = activeConv.id || activeConv._id;
    
    const getValidId = (obj) => {
      if (!obj) return null;
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'object') {
        const id = obj._id || obj.id;
        if (id) return String(id);
      }
      return String(obj);
    };

    let receiverId = null;
    const userIdStr = getValidId(user);
    const companyIdStr = getValidId(activeConv.company_id);
    
    if (companyIdStr === userIdStr) {
      receiverId = getValidId(activeConv.freelancer_id);
    } else {
      receiverId = getValidId(activeConv.company_id);
    }

    if (!receiverId || typeof receiverId !== 'string') {
       setError('Failed to identify message receiver.');
       return;
    }
    
    socket.emit('send_message', {
      conversationId: convId,
      text: newMessage,
      message: newMessage,
      receiverId: receiverId
    }, (response) => {
      if (response && response.success === false) {
        // Backend is the authority - it can lock the chat mid-session.
        if (response.code === 'SUBSCRIPTION_REQUIRED') {
          setIsLocked(true);
          setLockDetails(response.details || null);
        }
        setError(response.message || 'Failed to send message.');
      } else if (response && response.error) {
        setError(response.error);
      } else if (response && response.success && response.message) {
        setMessages(prev => {
          if (prev.find(m => (m._id || m.id) === (response.message._id || response.message.id))) return prev;
          return [...prev, response.message];
        });
        scrollToBottom();
        fetchConversations();
      }
    });

    setNewMessage('');
  };

  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  return (
    <div
      className={
        embedded
          ? 'w-full h-[calc(100vh-9rem)] min-h-[24rem] flex'
          : 'bg-brand-bg pt-[90px] pb-6 px-4 flex justify-center items-start h-screen'
      }
    >
      <div
        className={`w-full h-full flex bg-white rounded-xl shadow-sm border border-brand-border overflow-hidden ${
          embedded ? '' : 'max-w-[1200px]'
        }`}
      >
        {/* Conversation list */}
        <div
          className={`w-full md:w-[290px] md:flex-shrink-0 border-r border-brand-border bg-white flex-col ${
            mobileView === 'list' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <div className="h-[52px] px-3.5 flex items-center border-b border-brand-border bg-brand-surface shrink-0">
            <h2 className="text-[13px] font-semibold text-brand-navy uppercase tracking-wider">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
              <p className="p-4 text-brand-textSec text-sm text-center">No conversations yet.</p>
            ) : (
              conversations.map(conv => {
                const convId = conv.id || conv._id;
                let otherUser = {};
                const extractId = (obj) => {
                  if (!obj) return null;
                  if (typeof obj === 'object') return String(obj._id || obj.id || '');
                  return String(obj);
                };
                const userIdStr = String(user.id || user._id);
                const companyIdStr = extractId(conv.company_id);
                if (companyIdStr === userIdStr) {
                  otherUser = typeof conv.freelancer_id === 'object' ? conv.freelancer_id : { name: 'Freelancer' };
                } else {
                  otherUser = typeof conv.company_id === 'object' ? conv.company_id : { name: 'Company' };
                }

                const isActive = (activeConv?.id || activeConv?._id) === convId;
                const unread = isActive ? 0 : (conv.unread_count || 0);

                return (
                  <div 
                    key={convId} 
                    onClick={() => selectConversation(conv)}
                    className={`px-3 py-2.5 border-b border-brand-border cursor-pointer transition-colors ${isActive ? 'bg-brand-primary/5 border-l-[3px] border-l-brand-primary' : 'hover:bg-brand-primary/5 border-l-[3px] border-l-transparent'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar user={otherUser} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 truncate text-[13px] ${unread > 0 ? 'font-bold text-brand-navy' : 'font-semibold text-brand-navy'}`}>
                            {otherUser.name || otherUser.company_name || 'Unknown'}
                          </div>
                          {unread > 0 && (
                            <span
                              title={`${unread} unread message${unread === 1 ? '' : 's'}`}
                              className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center"
                            >
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                        <div className={`text-[12px] truncate mt-0.5 flex items-center gap-1 ${unread > 0 ? 'text-brand-navy font-medium' : 'text-brand-textSec'}`}>
                          {conv.is_locked && <span title="Subscription required">🔒</span>}
                          <span className="truncate">
                            {conv.last_message?.message || conv.last_message?.text || 'No messages'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div
          className={`flex-1 flex-col bg-brand-bg relative min-w-0 ${
            mobileView === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {isLocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 bg-white border border-brand-border rounded-full flex items-center justify-center shadow-sm mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-brand-navy mb-2">Messages Locked</h3>
              <p className="text-brand-textSec text-center max-w-md mb-2">
                An active subscription is required for both users to access chat.
              </p>
              {lockDetails && (
                <p className="text-sm text-brand-textSec text-center max-w-md mb-6">
                  {lockDetails.self_has_chat
                    ? 'Your plan is active — the other participant needs an active subscription before messaging resumes.'
                    : 'Your subscription is not active. Contact the admin to activate your plan.'}
                </p>
              )}
              <p className="text-xs text-brand-textSec text-center max-w-md mb-6">
                Your previous messages are safe and will reappear as soon as both subscriptions are active.
              </p>
              <button 
                onClick={() => navigate('/#pricing')}
                className="px-6 py-2.5 bg-brand-primary text-white rounded-full font-medium hover:bg-brand-primaryDark transition-all shadow-sm"
              >
                View Plans / Subscribe
              </button>
            </div>
          ) : activeConv ? (
            <>
              {/* Chat Header */}
              <div className="h-[52px] px-3 sm:px-4 border-b border-brand-border bg-white flex items-center gap-2 shadow-sm z-10 flex-shrink-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden p-1.5 -ml-1 rounded-md text-brand-textSec hover:text-brand-primary hover:bg-brand-primary/5 transition-colors shrink-0"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                {(() => {
                  let otherUser = {};
                  const extractId = (obj) => {
                    if (!obj) return null;
                    if (typeof obj === 'object') return String(obj._id || obj.id || '');
                    return String(obj);
                  };
                  const userIdStr = String(user.id || user._id);
                  const companyIdStr = extractId(activeConv.company_id);
                  if (companyIdStr === userIdStr) {
                    otherUser = typeof activeConv.freelancer_id === 'object' ? activeConv.freelancer_id : { name: 'Freelancer' };
                  } else {
                    otherUser = typeof activeConv.company_id === 'object' ? activeConv.company_id : { name: 'Company' };
                  }
                  return (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar user={otherUser} size="sm" />
                      <div className="min-w-0 leading-tight">
                        <p className="font-semibold text-[14px] text-brand-navy truncate">
                          {otherUser.name || otherUser.company_name || 'Chat'}
                        </p>
                        <p className="text-[11px] text-brand-textSec">
                          {activeConv?.is_locked ? 'Subscription required' : 'Active'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Message List */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 px-4 py-4 sm:px-5 overflow-y-auto custom-scrollbar flex flex-col space-y-2.5"
              >
                {messages.map((msg, index) => {
                  const msgId = msg.id || msg._id || index;
                  const senderId = msg.sender_id || msg.senderId;
                  const isMine = String(senderId) === String(user.id || user._id);
                  return (
                    <div key={msgId} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`px-3.5 py-2 rounded-2xl max-w-[80%] md:max-w-[65%] text-[13.5px] leading-relaxed shadow-sm ${
                        isMine 
                          ? 'bg-brand-primary text-white rounded-br-sm' 
                          : 'bg-white border border-brand-border text-brand-navy rounded-bl-sm'
                      }`}>
                        {msg.message || msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Error Banner */}
              {error && (
                <div className="px-4 py-2 bg-red-50 text-brand-danger text-sm text-center border-t border-red-100 flex-shrink-0">
                  {error}
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-brand-border flex-shrink-0">
                <form onSubmit={sendMessage} className="flex gap-2.5 items-end max-w-4xl mx-auto">
                  <textarea 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-white border border-brand-border rounded-[20px] px-4 py-2.5 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 shadow-none resize-none text-[13.5px] text-brand-navy max-h-[110px] custom-scrollbar"
                    rows="1"
                    disabled={!!error}
                  />
                  <button 
                    type="submit"
                    disabled={!!error || !newMessage.trim()}
                    className="h-[40px] px-5 bg-brand-primary text-white rounded-full hover:bg-brand-primaryDark disabled:opacity-50 text-[13px] font-medium transition-colors shadow-sm flex items-center justify-center flex-shrink-0"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-brand-textSec bg-brand-bg">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-brand-border">
                <svg className="w-8 h-8 text-brand-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="font-medium text-[15px]">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
