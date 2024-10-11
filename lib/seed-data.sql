INSERT INTO todolists (id, title, username)
VALUES (1, 'Work Todos', 'admin'),
(2, 'Home Todos', 'admin'),
(3, 'Additional Todos', 'admin'),
(4, 'social todos', 'admin');

INSERT INTO todos (title, done, todolist_id, username)
VALUES ('Get coffee', TRUE, 1, 'admin'),
('Chat with co-workers', TRUE, 1, 'admin'),
('Duck out of meeting', FALSE, 1, 'admin'),
('Feed the cats', TRUE, 2, 'admin'),
('Go to bed', TRUE, 2, 'admin'),
('Buy milk', TRUE, 2, 'admin'),
('Study for Launch School', TRUE, 2, 'admin'),
('Go to Libb''s birthday party', TRUE, 4, 'admin');