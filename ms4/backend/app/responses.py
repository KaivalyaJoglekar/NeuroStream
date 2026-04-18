from math import ceil

from fastapi.responses import JSONResponse


def success_response(data, message: str | None = None, status_code: int = 200):
    payload = {
        "success": True,
        "data": data,
    }
    if message:
        payload["message"] = message
    return JSONResponse(status_code=status_code, content=payload)


def paginated_response(data, page: int, limit: int, total: int):
    return {
        "success": True,
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": ceil(total / limit) if limit else 0,
        },
    }


def error_response(error: str, status_code: int = 400):
    return JSONResponse(status_code=status_code, content={"success": False, "error": error})
