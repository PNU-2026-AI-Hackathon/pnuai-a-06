from fastapi import Header, HTTPException, Query, Response, status


DEFAULT_LOCALE = "ko"
SUPPORTED_LOCALES = frozenset({"ko", "en"})


def normalize_locale(value: str | None, *, strict: bool = False) -> str:
    if not value:
        return DEFAULT_LOCALE
    locale = value.strip().lower().replace("_", "-").split("-", 1)[0]
    if locale in SUPPORTED_LOCALES:
        return locale
    if strict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_LOCALE",
                "message": f"Supported languages are: {', '.join(sorted(SUPPORTED_LOCALES))}.",
            },
        )
    return DEFAULT_LOCALE


def _preferred_header_locale(accept_language: str | None) -> str:
    if not accept_language:
        return DEFAULT_LOCALE
    weighted: list[tuple[float, int, str]] = []
    for index, item in enumerate(accept_language.split(",")):
        parts = [part.strip() for part in item.split(";")]
        language = parts[0]
        quality = 1.0
        for parameter in parts[1:]:
            if parameter.startswith("q="):
                try:
                    quality = float(parameter[2:])
                except ValueError:
                    quality = 0.0
        language_code = language.lower().replace("_", "-").split("-", 1)[0]
        if language == "*":
            weighted.append((quality, -index, DEFAULT_LOCALE))
        elif language_code in SUPPORTED_LOCALES:
            weighted.append((quality, -index, language_code))
    return max(weighted, default=(1.0, 0, DEFAULT_LOCALE))[2]


def resolve_locale(
    response: Response,
    lang: str | None = Query(
        default=None,
        description="Response language. Supports ko and en; overrides Accept-Language.",
    ),
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> str:
    locale = normalize_locale(lang, strict=True) if lang else _preferred_header_locale(accept_language)
    response.headers["Content-Language"] = locale
    response.headers["Vary"] = "Accept-Language"
    return locale
