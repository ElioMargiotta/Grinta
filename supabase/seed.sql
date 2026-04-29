-- Optional seed: a few example exercises for the currently logged-in trainer.
-- Run from the Supabase SQL editor while authenticated as a trainer,
-- or wrap in a script that sets `request.jwt.claim.sub` to a trainer's UUID.
--
-- Replace 'YOUR_TRAINER_UUID' below with the trainer's profiles.id before running.

insert into exercises (trainer_id, name, description, category, duration_minutes, intensity, equipment)
values
  ('YOUR_TRAINER_UUID', 'Dynamic warmup',
   'Jogging, high knees, butt kicks, lunges, leg swings. Get the body ready.',
   'warmup', 10, 'low', array['cones']),
  ('YOUR_TRAINER_UUID', 'Rondo 4v2',
   'Two-touch rondo in a 6m square. Defenders rotate after winning the ball.',
   'technical', 15, 'medium', array['balls','cones']),
  ('YOUR_TRAINER_UUID', 'Pressing triggers',
   'Walkthrough then live: pressing triggers on back-pass and bad first touch.',
   'tactical', 20, 'high', array['balls','bibs']),
  ('YOUR_TRAINER_UUID', 'Small-sided 5v5',
   'Two small goals, 30x40 area, 4x4 minute games with 1 min rest.',
   'physical', 25, 'high', array['balls','goals','bibs']),
  ('YOUR_TRAINER_UUID', 'Cooldown + stretch',
   'Light jogging, static stretches focused on hamstrings, quads, calves.',
   'cooldown', 8, 'low', array[]::text[]);
