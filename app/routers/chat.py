"""
Chat Router - API endpoints for Text-to-SQL chat functionality.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json

from app.services.chat_engine import process_chat_question, process_chat_streaming


router = APIRouter(prefix="/api/chat", tags=["chat"])


# ============ Pydantic Models ============

class ChatQueryRequest(BaseModel):
    """Request model for chat query endpoint"""
    question: str
    previous_sql: Optional[str] = None


class ChatQueryResponse(BaseModel):
    """Response model for chat query endpoint"""
    status: str  # 'success' or 'error'
    model_used: Optional[str] = None
    thought_trace: str = ""
    sql_code: str = ""
    columns: List[str] = []
    results: List[List[str]] = []
    suggestions: List[str] = []
    data_summary: str = ""
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    message: str


# ============ API Endpoints ============

@router.get("/health", response_model=HealthResponse)
async def chat_health_check():
    """Health check endpoint for chat service"""
    return HealthResponse(
        status="healthy",
        message="Chat API is running"
    )


@router.post("/query", response_model=ChatQueryResponse)
async def submit_chat_query(request: ChatQueryRequest):
    """
    Process a natural language query and return SQL results.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    try:
        result = await process_chat_question(
            user_question=request.question.strip(),
            previous_sql=request.previous_sql
        )
        
        # Extract data from result
        status = result.get("status", "error")
        model_used = result.get("model_used")
        steps = result.get("steps", [])
        final_data = result.get("final_data", [])
        columns = result.get("columns", [])
        suggestions = result.get("suggestions", [])
        data_summary = result.get("data_summary", "")
        
        # Get the last step for thought trace and SQL
        last_step = steps[-1] if steps else {}
        thought_trace = last_step.get("thought", "") or ""
        sql_code = last_step.get("sql", "") or ""
        error_msg = last_step.get("error", "") or ""
        
        # If there was a retry, include first attempt's error in the trace
        if len(steps) > 1:
            first_err = steps[0].get("error", "Unknown error")
            thought_trace = f"[Attempt 1 Failed: {first_err}]\n\nRetry Thought: {thought_trace}"
        
        # Convert data to list of lists format
        table_rows = []
        if final_data and len(final_data) > 0:
            for row_dict in final_data:
                row_values = [str(row_dict.get(col, "")) for col in columns]
                table_rows.append(row_values)
        
        return ChatQueryResponse(
            status=status,
            model_used=model_used,
            thought_trace=thought_trace,
            sql_code=sql_code,
            columns=columns,
            results=table_rows,
            suggestions=suggestions,
            data_summary=data_summary,
            error=error_msg if status == "error" else None
        )
        
    except Exception as e:
        print(f"[CHAT ERROR] Query processing failed: {e}")
        return ChatQueryResponse(
            status="error",
            error=str(e)
        )


@router.post("/query/stream")
async def stream_chat_query(request: ChatQueryRequest):
    """
    SSE streaming endpoint for progressive query results.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    async def event_generator():
        try:
            async for event in process_chat_streaming(
                user_question=request.question.strip(),
                previous_sql=request.previous_sql
            ):
                event_type = event.get("event", "message")
                event_data = event.get("data", "")
                
                # Format as SSE
                if isinstance(event_data, (dict, list)):
                    data_str = json.dumps(event_data)
                else:
                    data_str = str(event_data)
                
                yield f"event: {event_type}\ndata: {data_str}\n\n"
                
        except Exception as e:
            print(f"[CHAT SSE ERROR] Stream error: {e}")
            yield f"event: error\ndata: {str(e)}\n\n"
            yield f"event: done\ndata: {{\"status\": \"error\"}}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
