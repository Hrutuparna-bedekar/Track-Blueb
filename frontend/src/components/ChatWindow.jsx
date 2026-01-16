import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, ChevronDown, ChevronUp, Sparkles, Trash2 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const STORAGE_KEY = 'viotrack_chat_history'
const SQL_STORAGE_KEY = 'viotrack_last_sql'

/**
 * ChatWindow Component
 * Floating chat panel for natural language queries to the VioTrack database.
 */
function ChatWindow({ isOpen, onClose }) {
    const { t } = useLanguage()

    // Load from localStorage on init
    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [lastSql, setLastSql] = useState(() => {
        try {
            return localStorage.getItem(SQL_STORAGE_KEY) || null
        } catch {
            return null
        }
    })
    const [suggestions, setSuggestions] = useState([])
    const [currentStatus, setCurrentStatus] = useState('')
    const [expandedMessages, setExpandedMessages] = useState({})
    const messagesEndRef = useRef(null)

    // Save messages to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
        } catch (e) {
            console.error('Failed to save chat history:', e)
        }
    }, [messages])

    // Save lastSql to localStorage
    useEffect(() => {
        try {
            if (lastSql) {
                localStorage.setItem(SQL_STORAGE_KEY, lastSql)
            }
        } catch (e) {
            console.error('Failed to save last SQL:', e)
        }
    }, [lastSql])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Clear chat history
    const handleClearHistory = () => {
        setMessages([])
        setSuggestions([])
        setLastSql(null)
        setExpandedMessages({})
        try {
            localStorage.removeItem(STORAGE_KEY)
            localStorage.removeItem(SQL_STORAGE_KEY)
        } catch (e) {
            console.error('Failed to clear storage:', e)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const question = inputValue.trim()
        if (!question || isLoading) return

        // Add user message
        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: question
        }
        setMessages(prev => [...prev, userMessage])
        setInputValue('')
        setSuggestions([])
        setCurrentStatus('')
        setIsLoading(true)

        // Create streaming assistant message placeholder
        const assistantId = Date.now() + 1
        const streamingMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            thought_trace: '',
            sql_code: '',
            columns: [],
            results: [],
            data_summary: '',
            error: null,
            isStreaming: true,
            streamingStatus: 'Connecting...',
            model_used: ''
        }
        setMessages(prev => [...prev, streamingMessage])

        try {
            const response = await fetch('/api/chat/query/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, previous_sql: lastSql })
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        const eventType = line.slice(7)
                        const dataLine = lines[lines.indexOf(line) + 1]
                        if (dataLine && dataLine.startsWith('data: ')) {
                            const data = dataLine.slice(6)
                            handleSSEEvent(assistantId, eventType, data)
                        }
                    }
                }
            }
        } catch (error) {
            setMessages(prev => {
                const updated = [...prev]
                const msgIndex = updated.findIndex(m => m.id === assistantId)
                if (msgIndex !== -1) {
                    updated[msgIndex] = {
                        ...updated[msgIndex],
                        error: error.message || 'An unexpected error occurred',
                        content: 'Error processing query',
                        isStreaming: false
                    }
                }
                return updated
            })
            setSuggestions([])
        } finally {
            setIsLoading(false)
            setCurrentStatus('')
        }
    }

    const handleSSEEvent = (assistantId, eventType, data) => {
        setMessages(prev => {
            const updated = [...prev]
            const msgIndex = updated.findIndex(m => m.id === assistantId)
            if (msgIndex === -1) return prev

            const msg = { ...updated[msgIndex] }
            let parsedData

            try {
                parsedData = JSON.parse(data)
            } catch {
                parsedData = data
            }

            switch (eventType) {
                case 'status':
                    msg.streamingStatus = parsedData
                    setCurrentStatus(parsedData)
                    break
                case 'model':
                    msg.model_used = parsedData
                    msg.content = `Processing with ${parsedData} model...`
                    break
                case 'thought':
                    msg.thought_trace = parsedData
                    break
                case 'sql':
                    msg.sql_code = parsedData
                    setLastSql(parsedData)
                    break
                case 'table':
                    msg.columns = parsedData.columns || []
                    msg.results = parsedData.results || []
                    msg.content = `Found ${msg.results.length} results.`
                    break
                case 'suggestions':
                    setSuggestions(parsedData || [])
                    break
                case 'summary':
                    msg.data_summary = parsedData
                    break
                case 'error':
                    msg.error = parsedData
                    msg.content = 'Error processing query'
                    break
                case 'done':
                    msg.isStreaming = false
                    msg.streamingStatus = ''
                    if (!msg.content || msg.content.includes('Processing')) {
                        msg.content = msg.results.length > 0
                            ? `Found ${msg.results.length} results.`
                            : 'Query completed.'
                    }
                    break
                default:
                    break
            }

            updated[msgIndex] = msg
            return updated
        })
    }

    const handleSuggestionClick = async (suggestion) => {
        // Auto-submit the suggestion instead of just filling input
        if (isLoading) return
        setInputValue('')
        setSuggestions([])
        setCurrentStatus('')
        setIsLoading(true)

        // Add user message
        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: suggestion
        }
        setMessages(prev => [...prev, userMessage])

        // Create streaming assistant message
        const assistantId = Date.now() + 1
        const streamingMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            thought_trace: '',
            sql_code: '',
            columns: [],
            results: [],
            data_summary: '',
            error: null,
            isStreaming: true,
            streamingStatus: 'Connecting...',
            model_used: ''
        }
        setMessages(prev => [...prev, streamingMessage])

        try {
            const response = await fetch('/api/chat/query/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: suggestion, previous_sql: lastSql })
            })

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        const eventType = line.slice(7)
                        const dataLine = lines[lines.indexOf(line) + 1]
                        if (dataLine && dataLine.startsWith('data: ')) {
                            handleSSEEvent(assistantId, eventType, dataLine.slice(6))
                        }
                    }
                }
            }
        } catch (error) {
            setMessages(prev => {
                const updated = [...prev]
                const msgIndex = updated.findIndex(m => m.id === assistantId)
                if (msgIndex !== -1) {
                    updated[msgIndex] = {
                        ...updated[msgIndex],
                        error: error.message || 'An unexpected error occurred',
                        content: 'Error processing query',
                        isStreaming: false
                    }
                }
                return updated
            })
            setSuggestions([])
        } finally {
            setIsLoading(false)
            setCurrentStatus('')
        }
    }

    const toggleMessageExpand = (messageId) => {
        setExpandedMessages(prev => ({
            ...prev,
            [messageId]: !prev[messageId]
        }))
    }

    if (!isOpen) return null

    return (
        <div className="chat-window">
            {/* Header */}
            <div className="chat-header">
                <div className="chat-header-title">
                    <Sparkles size={18} />
                    <span>{t('Ask VioTrack')}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {messages.length > 0 && (
                        <button
                            className="chat-close-btn"
                            onClick={handleClearHistory}
                            title={t('Clear history')}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button className="chat-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <MessageSquare size={32} style={{ opacity: 0.3 }} />
                        <p>{t('Ask questions about violations, videos, or individuals')}</p>
                        <p className="chat-example">
                            {t('Try')}: "{t('How many violations today?')}"
                        </p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`chat-message ${msg.role}`}>
                            {msg.role === 'user' ? (
                                <div className="chat-user-bubble">{msg.content}</div>
                            ) : (
                                <div className="chat-assistant-bubble">
                                    {msg.isStreaming ? (
                                        <div className="chat-streaming">
                                            <div className="chat-spinner" />
                                            <span>{msg.streamingStatus}</span>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Summary or content */}
                                            {msg.data_summary && (
                                                <div className="chat-summary">{msg.data_summary}</div>
                                            )}
                                            {!msg.data_summary && msg.content && (
                                                <div className="chat-content">{msg.content}</div>
                                            )}

                                            {/* Error */}
                                            {msg.error && (
                                                <div className="chat-error">{msg.error}</div>
                                            )}

                                            {/* Results table */}
                                            {msg.results && msg.results.length > 0 && (
                                                <div className="chat-table-container">
                                                    <table className="chat-table">
                                                        <thead>
                                                            <tr>
                                                                {msg.columns.map((col, i) => (
                                                                    <th key={i}>{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {msg.results.slice(0, 5).map((row, i) => (
                                                                <tr key={i}>
                                                                    {row.map((cell, j) => (
                                                                        <td key={j}>{cell}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {msg.results.length > 5 && (
                                                        <div className="chat-more-rows">
                                                            +{msg.results.length - 5} {t('more rows')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Expandable SQL/Thought */}
                                            {(msg.sql_code || msg.thought_trace) && (
                                                <button
                                                    className="chat-expand-btn"
                                                    onClick={() => toggleMessageExpand(msg.id)}
                                                >
                                                    {expandedMessages[msg.id] ? (
                                                        <><ChevronUp size={14} /> {t('Hide details')}</>
                                                    ) : (
                                                        <><ChevronDown size={14} /> {t('Show SQL')}</>
                                                    )}
                                                </button>
                                            )}
                                            {expandedMessages[msg.id] && (
                                                <div className="chat-details">
                                                    {msg.thought_trace && (
                                                        <div className="chat-thought">
                                                            <strong>{t('Reasoning')}:</strong>
                                                            <p>{msg.thought_trace}</p>
                                                        </div>
                                                    )}
                                                    {msg.sql_code && (
                                                        <div className="chat-sql">
                                                            <strong>SQL:</strong>
                                                            <pre>{msg.sql_code}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && !isLoading && (
                <div className="chat-suggestions">
                    {suggestions.map((s, i) => (
                        <button key={i} onClick={() => handleSuggestionClick(s)}>
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Status bar */}
            {currentStatus && (
                <div className="chat-status">
                    <div className="chat-status-dot" />
                    <span>{currentStatus}</span>
                </div>
            )}

            {/* Input */}
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={t('Ask about violations...')}
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !inputValue.trim()}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    )
}

export default ChatWindow
