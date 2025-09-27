from setuptools import setup, find_packages
import os

# Read the README file
def read_readme():
    readme_path = os.path.join(os.path.dirname(__file__), 'README.md')
    if os.path.exists(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as fh:
            return fh.read()
    return ''

# Read version from __init__.py
def get_version():
    init_path = os.path.join(os.path.dirname(__file__), 'cursor_telemetry', '__init__.py')
    if os.path.exists(init_path):
        with open(init_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('__version__'):
                    return line.split('=')[1].strip().strip('"').strip("'")
    return '1.0.0'

setup(
    name="cursor-telemetry-sdk",
    version=get_version(),
    author="Cursor Telemetry Team",
    author_email="team@cursor-telemetry.com",
    description="Official Python SDK for Cursor Telemetry API",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/cursor-telemetry/sdk",
    project_urls={
        "Bug Tracker": "https://github.com/cursor-telemetry/sdk/issues",
        "Documentation": "https://docs.cursor-telemetry.com",
        "Source Code": "https://github.com/cursor-telemetry/sdk",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "Topic :: Software Development :: Quality Assurance",
        "Topic :: Software Development :: Testing",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
        "websockets>=10.0",
        "pydantic>=1.10.0",
        "pandas>=1.5.0",
        "numpy>=1.21.0",
        "jupyter>=1.0.0",
        "aiohttp>=3.8.0",
        "asyncio-mqtt>=0.11.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "black>=22.0.0",
            "flake8>=5.0.0",
            "mypy>=1.0.0",
            "pre-commit>=2.20.0",
        ],
        "data-science": [
            "matplotlib>=3.5.0",
            "seaborn>=0.11.0",
            "plotly>=5.0.0",
            "scikit-learn>=1.1.0",
            "scipy>=1.9.0",
        ],
        "notebook": [
            "ipykernel>=6.0.0",
            "ipywidgets>=8.0.0",
            "jupyterlab>=3.0.0",
        ],
        "cli": [
            "click>=8.0.0",
            "rich>=12.0.0",
            "typer>=0.7.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "cursor-telemetry=cursor_telemetry.cli:main",
        ],
    },
    include_package_data=True,
    package_data={
        "cursor_telemetry": ["py.typed"],
    },
    zip_safe=False,
    keywords=[
        "cursor",
        "telemetry",
        "api",
        "sdk",
        "dashboard",
        "analytics",
        "jupyter",
        "notebook",
        "data-science",
        "development",
        "monitoring",
    ],
)
