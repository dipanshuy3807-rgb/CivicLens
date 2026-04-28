MOCK_COORDINATES = {
    "Virar East": (19.455, 72.815),
    "Virar West": (19.45, 72.81),
    "Nallasopara West": (19.421, 72.822),
    "Nallasopara East": (19.416, 72.835),
    "Vasai Road": (19.391, 72.839),
    "Vasai East": (19.407, 72.872),
    "Vasai West": (19.369, 72.812),
    "Station": (19.451, 72.817),
}


def geocode_location(location: str):
    return MOCK_COORDINATES.get(location or "", (None, None))
