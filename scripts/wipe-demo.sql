-- Removes the demo walk and everything hanging off it. The real walks are
-- untouched: posts, messages, reactions and keys all cascade from the row.
delete from ultreia_walks where slug = 'demo';
