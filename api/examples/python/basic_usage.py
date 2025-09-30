"""
Basic usage examples for Cursor Telemetry Python SDK
"""

import asyncio
from cursor_telemetry import CursorTelemetryAPI, create_client

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
        search_results = api.search_sessions("jupyter")
        print(f"Found {len(search_results)} sessions matching 'jupyter'")
        
        # Get specific session
        if sessions:
            session_id = sessions[0].id
            print(f"Getting details for session: {session_id}")
            session = api.get_session(session_id)
            print(f"Session details: {session.name}")
            
            # Generate notebook from session
            print("Generating notebook...")
            notebook = api.generate_notebook(session_id, include_metadata=True, format="jupyter")
            print(f"Generated notebook: {notebook.name}")
            
            # Get session visualizations
            print("Getting visualizations...")
            visualizations = api.get_session_visualizations(session_id)
            print(f"Visualizations: {len(visualizations)} charts")
        
        # Get projects
        print("Fetching projects...")
        projects = api.get_projects()
        print(f"Found {len(projects)} projects")
        
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
        await api.listen_for_updates(handle_update)
        
    except Exception as error:
        print(f"Error: {error}")

def data_science_workflow():
    """Example data science workflow"""
    api = create_client(base_url="http://localhost:3000")
    
    try:
        # Get sessions with data science focus
        sessions = api.search_sessions("data analysis")
        
        for session in sessions:
            print(f"Processing session: {session.name}")
            
            # Generate notebook
            notebook = api.generate_notebook(session.id, {
                "include_metadata": True,
                "format": "jupyter",
                "add_cells": True
            })
            
            # Get analytics for this session
            visualizations = api.get_session_visualizations(session.id)
            
            # Create memory for future reference
            memory = api.create_memory(session.id, {
                "name": f"Analysis: {session.name}",
                "type": "notebook",
                "tags": ["data-science", "analysis"]
            })
            
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
        # Create export
        export_data = api.create_export({
            "format": "json",
            "include_sessions": True,
            "include_analytics": True,
            "date_range": {
                "start": "2024-01-01",
                "end": "2024-12-31"
            }
        })
        
        print(f"Created export: {export_data['filename']}")
        
        # List all exports
        exports = api.list_exports()
        print(f"Available exports: {len(exports)}")
        
        # Download export
        if exports:
            filename = exports[0]['filename']
            content = api.download_export(filename)
            print(f"Downloaded {len(content)} bytes")
        
    except Exception as error:
        print(f"Error: {error}")

if __name__ == "__main__":
    print("=== Basic Usage ===")
    basic_usage()
    
    print("\n=== Data Science Workflow ===")
    data_science_workflow()
    
    print("\n=== Export and Share ===")
    export_and_share()
    
    print("\n=== Async Usage ===")
    # Uncomment to run async example
    # asyncio.run(async_usage())
