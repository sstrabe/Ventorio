-- Ventorio schema. Times are ISO 8601 UTC strings; events.starts_at is the
-- local date and time as entered (YYYY-MM-DDTHH:MM).

-- What kinds of things exist. Equipment is individually labelled and tracked
-- unit by unit; supplies are consumables counted as a stock level.
CREATE TABLE item_types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    kind TEXT NOT NULL CHECK (kind IN ('equipment', 'supply')),
    needs_cleaning INTEGER NOT NULL DEFAULT 0 CHECK (needs_cleaning IN (0, 1)),
    stock INTEGER NOT NULL DEFAULT 0,
    reorder_at INTEGER CHECK (reorder_at >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- One line of a template: `amount` per attendee, or per event when
-- per_attendee = 0. Fractions are allowed (0.5 per attendee = one per two).
CREATE TABLE template_lines (
    template_id INTEGER NOT NULL REFERENCES templates (id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES item_types (id) ON DELETE CASCADE,
    amount REAL NOT NULL CHECK (amount > 0),
    per_attendee INTEGER NOT NULL CHECK (per_attendee IN (0, 1)),
    PRIMARY KEY (template_id, type_id)
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    starts_at TEXT,
    location TEXT,
    attendees INTEGER NOT NULL CHECK (attendees >= 0),
    template_id INTEGER REFERENCES templates (id) ON DELETE SET NULL,
    instructor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'out', 'returned')),
    packed_at TEXT,
    returned_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX events_status ON events (status, starts_at);

-- The packing list. Lines from the template are recomputed when attendees or
-- the template change; manual lines (edited by hand) are kept as they are.
CREATE TABLE event_lines (
    event_id INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES item_types (id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    manual INTEGER NOT NULL DEFAULT 0 CHECK (manual IN (0, 1)),
    supplies_out INTEGER,
    supplies_back INTEGER,
    PRIMARY KEY (event_id, type_id)
);

-- A labelled unit of equipment. `code` is what its QR code and NFC tag carry.
CREATE TABLE items (
    code TEXT PRIMARY KEY,
    type_id INTEGER NOT NULL REFERENCES item_types (id),
    name TEXT,
    serial TEXT,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'out', 'needs_cleaning', 'repair', 'missing', 'retired')),
    event_id INTEGER REFERENCES events (id) ON DELETE SET NULL,
    notes TEXT,
    last_used_at TEXT,
    last_cleaned_at TEXT,
    last_maintained_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX items_type ON items (type_id, status);
CREATE UNIQUE INDEX items_serial ON items (serial) WHERE serial IS NOT NULL;

-- Equipment that went out with an event.
CREATE TABLE event_items (
    event_id INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    item_code TEXT NOT NULL REFERENCES items (code) ON DELETE CASCADE,
    packed_at TEXT NOT NULL,
    packed_by TEXT NOT NULL,
    returned_at TEXT,
    returned_by TEXT,
    PRIMARY KEY (event_id, item_code)
);

CREATE INDEX event_items_item ON event_items (item_code);

CREATE TABLE item_log (
    id INTEGER PRIMARY KEY,
    item_code TEXT NOT NULL REFERENCES items (code) ON DELETE CASCADE,
    action TEXT NOT NULL,
    event_id INTEGER REFERENCES events (id) ON DELETE SET NULL,
    note TEXT,
    by TEXT NOT NULL,
    at TEXT NOT NULL
);

CREATE INDEX item_log_item ON item_log (item_code, at);

CREATE TABLE supply_log (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL REFERENCES item_types (id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('restock', 'count', 'event', 'return')),
    event_id INTEGER REFERENCES events (id) ON DELETE SET NULL,
    by TEXT NOT NULL,
    at TEXT NOT NULL
);

CREATE INDEX supply_log_type ON supply_log (type_id, at);

-- Where a tapped tag (/t/<code>) is recorded: the event a person is packing
-- or returning right now. One per person.
CREATE TABLE scan_sessions (
    email TEXT PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('pack', 'return')),
    updated_at TEXT NOT NULL
);
