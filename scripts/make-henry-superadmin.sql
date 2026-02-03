-- Script to set user "henry" as superadmin
-- Run this against your PostgreSQL database

UPDATE users
SET role = 'superadmin', is_superadmin = TRUE
WHERE username = 'henry';

-- Verify the update
SELECT id, username, role, is_superadmin FROM users WHERE username = 'henry';
