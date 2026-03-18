"""
Rate limiter configuration using slowapi.

Provides a shared Limiter instance for IP-based rate limiting across all endpoints.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
