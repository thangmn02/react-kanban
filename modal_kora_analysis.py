"""Compatibility entrypoint for the established Modal app; one real worker."""
from modal_kora_jobs import app, analyze_range, enqueue

__all__ = ["app", "analyze_range", "enqueue"]
