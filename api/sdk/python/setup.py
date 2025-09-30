from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="cursor-telemetry-sdk",
    version="1.0.0",
    author="Cursor Telemetry Team",
    author_email="team@cursor-telemetry.com",
    description="Official Python SDK for Cursor Telemetry API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/hamidahoderinwale/cursor-telemetry",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Information Analysis",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
        "websockets>=10.0",
        "pydantic>=1.10.0",
        "pandas>=1.5.0",
        "numpy>=1.21.0",
        "jupyter>=1.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=22.0.0",
            "flake8>=5.0.0",
            "mypy>=1.0.0",
        ],
        "data-science": [
            "matplotlib>=3.5.0",
            "seaborn>=0.11.0",
            "plotly>=5.0.0",
            "scikit-learn>=1.1.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "cursor-telemetry=cursor_telemetry.cli:main",
        ],
    },
)
