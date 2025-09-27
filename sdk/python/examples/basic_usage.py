"""
Basic usage examples for Cursor Telemetry Python SDK
"""

import asyncio
from cursor_telemetry import CursorTelemetryAPI, create_client, SearchOptions


def basic_usage():
    """Basic synchronous usage example"""
    # Initialize the API client
    api = create_client(
        base_url="http://localhost:3000",
        api_key="your-api-key"  # Optional
    )
    
    try:
        # Get all sessions
        print("Fetching all sessions...")
        sessions = api.get_sessions()
        print(f"Found {len(sessions)} sessions")
        
        # Search sessions
        print("Searching sessions...")
        search_options = SearchOptions(query="jupyter", limit=5)
        search_results = api.search_sessions(search_options)
        print(f"Found {len(search_results)} sessions matching 'jupyter'")
        
        # Get specific session
        if sessions:
            session_id = sessions[0].id
            print(f"Getting details for session: {session_id}")
            session = api.get_session(session_id)
            print(f"Session details: {session.name}")
            
            # Generate notebook from session
            print("Generating notebook...")
            notebook = api.generate_notebook(session_id)
            print(f"Generated notebook: {notebook.name}")
        
        # Get analytics
        print("Fetching analytics...")
        analytics = api.get_stats()
        print(f"Total sessions: {analytics.total_sessions}")
        print(f"Total duration: {analytics.total_duration} seconds")
        
        # Get memories
        print("Fetching memories...")
        memories = api.get_memories()
        print(f"Found {len(memories)} memories")
        
        # Health check
        is_healthy = api.health_check()
        print(f"API health: {'OK' if is_healthy else 'ERROR'}")
        
    except Exception as error:
        print(f"Error: {error}")


async def async_usage():
    """Asynchronous usage example with WebSocket"""
    api = create_client(
        base_url="http://localhost:3000",
        api_key="your-api-key"
    )
    
    async def handle_update(data):
        """Handle real-time updates"""
        print(f"Real-time update: {data}")
    
    try:
        # Connect to WebSocket for real-time updates
        print("Connecting to WebSocket...")
        await api.connect_websocket()
        
        # Register event handlers
        api.on("sessions-updated", handle_update)
        api.on("session-created", handle_update)
        api.on("file-changed", handle_update)
        
        # Keep connection alive for a while
        await asyncio.sleep(30)
        
    except Exception as error:
        print(f"Error: {error}")
    finally:
        await api.disconnect_websocket()


def data_science_workflow():
    """Example data science workflow"""
    api = create_client(base_url="http://localhost:3000")
    
    try:
        # Get sessions with data science focus
        search_options = SearchOptions(query="data analysis", limit=5)
        sessions = api.search_sessions(search_options)
        
        for session in sessions:
            print(f"Processing session: {session.name}")
            
            # Generate notebook
            notebook = api.generate_notebook(session.id)
            
            # Create memory for future reference
            from cursor_telemetry import MemoryCreationOptions
            memory_options = MemoryCreationOptions(
                name=f"Analysis: {session.name}",
                type="notebook",
                tags=["data-science", "analysis"],
                description="Generated from data analysis session"
            )
            memory = api.create_memory(session.id, memory_options)
            
            print(f"Created memory: {memory.name}")
        
        # Get overall analytics
        analytics = api.get_stats()
        print(f"Data science sessions: {analytics.total_sessions}")
        
    except Exception as error:
        print(f"Error: {error}")


def export_and_share():
    """Example of exporting and sharing data"""
    api = create_client(base_url="http://localhost:3000")
    
    try:
        # Get sessions for export
        sessions = api.get_sessions()
        
        # Export data (this would need to be implemented in the API)
        print(f"Found {len(sessions)} sessions to export")
        
        # Get memories
        memories = api.get_memories()
        print(f"Found {len(memories)} memories")
        
        # Example of executing a memory
        if memories:
            memory = memories[0]
            print(f"Executing memory: {memory.name}")
            
            from cursor_telemetry import ExecutionContext
            context = ExecutionContext(
                target_directory="/tmp/test",
                parameters={"dataset_path": "/data/sample.csv"}
            )
            
            # result = api.execute_memory(memory.id, context)
            # print(f"Execution result: {result.success}")
        
    except Exception as error:
        print(f"Error: {error}")


def memory_management():
    """Example of memory management operations"""
    api = create_client(base_url="http://localhost:3000")
    
    try:
        # Get all memories
        memories = api.get_memories()
        print(f"Total memories: {len(memories)}")
        
        # Search memories
        search_options = SearchOptions(query="visualization", limit=10)
        visualization_memories = api.search_memories(search_options)
        print(f"Visualization memories: {len(visualization_memories)}")
        
        # Get memory details
        if memories:
            memory = memories[0]
            detailed_memory = api.get_memory(memory.id)
            print(f"Memory details: {detailed_memory.name}")
            print(f"Created: {detailed_memory.created_at}")
            print(f"Type: {detailed_memory.type}")
        
        # Get memory statistics
        # stats = api.get_memory_stats()  # This would need to be implemented
        
    except Exception as error:
        print(f"Error: {error}")


def analytics_example():
    """Example of analytics usage"""
    api = create_client(base_url="http://localhost:3000")
    
    try:
        # Get system statistics
        stats = api.get_stats()
        print("=== System Statistics ===")
        print(f"Total sessions: {stats.total_sessions}")
        print(f"Total duration: {stats.total_duration} seconds")
        print(f"Average session length: {stats.average_session_length} seconds")
        
        # Get detailed analytics
        analytics = api.get_analytics()
        print("\n=== Detailed Analytics ===")
        print(f"Analytics data: {len(analytics)} fields")
        
        # Get most active files
        if stats.most_active_files:
            print("\n=== Most Active Files ===")
            for file_info in stats.most_active_files[:5]:
                print(f"{file_info['file']}: {file_info['count']} changes")
        
        # Get session trends
        if stats.session_trends:
            print("\n=== Session Trends ===")
            for trend in stats.session_trends[-5:]:  # Last 5 trends
                print(f"{trend['date']}: {trend['count']} sessions")
        
    except Exception as error:
        print(f"Error: {error}")


if __name__ == "__main__":
    print("=== Basic Usage ===")
    basic_usage()
    
    print("\n=== Data Science Workflow ===")
    data_science_workflow()
    
    print("\n=== Export and Share ===")
    export_and_share()
    
    print("\n=== Memory Management ===")
    memory_management()
    
    print("\n=== Analytics Example ===")
    analytics_example()
    
    print("\n=== Async Usage ===")
    # Uncomment to run async example
    # asyncio.run(async_usage())
