-- Migration 008: A deeper pool of core-banking records for repeated demo runs
--
-- Run this once against the Neon Postgres database used by this app (the same
-- DATABASE_URL as src/lib/db.ts). Safe to re-run.
--
-- Migration 007 seeded 8 passbook records, but 4 of them are immediately
-- claimed by the seeded users and 1 is closed, leaving only 3 an applicant can
-- actually register against. `users.account_number` and `users.mobile` are both
-- UNIQUE, so the fourth run of the registration demo fails with a duplicate-key
-- error rather than anything explicable.
--
-- These 20 spare records exist purely so /api/demo/applicant has something to
-- hand out. Every one is active and unclaimed; the demo endpoint picks a random
-- free one and only reports exhaustion once they're genuinely all used.
--
-- Mobile numbers use a 9826 prefix, deliberately disjoint from migration 007's
-- 9825 block, so a seeded record can never collide with one of these.

INSERT INTO bank_accounts
  (account_number, full_name, mobile, branch, ifsc, date_of_birth, is_active)
VALUES
  ('10250043100789', 'Vikram Suresh Joshi',   '9826010001', 'Ahmedabad - Navrangpura', 'BARB0NAVRAN', '1986-02-11', true),
  ('10250043100790', 'Ananya Rajesh Iyer',    '9826010002', 'Ahmedabad - Bodakdev',    'BARB0BODAKD', '1994-06-23', true),
  ('10250043100791', 'Rohit Anil Kulkarni',   '9826010003', 'Surat - Ring Road',       'BARB0RINGRD', '1989-10-04', true),
  ('10250043100792', 'Meera Sanjay Desai',    '9826010004', 'Vadodara - Alkapuri',     'BARB0ALKAPU', '1991-03-19', true),
  ('10250043100793', 'Karan Deepak Malhotra', '9826010005', 'Rajkot - Kalawad Rd',     'BARB0KALAWD', '1993-08-30', true),
  ('10250043100794', 'Divya Prakash Menon',   '9826010006', 'Gandhinagar - Sector 11', 'BARB0GANDHI', '1990-12-07', true),
  ('10250043100795', 'Aditya Mohan Bhatt',    '9826010007', 'Bharuch - Station Rd',    'BARB0BHARUC', '1987-05-16', true),
  ('10250043100796', 'Sneha Vinod Chauhan',   '9826010008', 'Ahmedabad - Navrangpura', 'BARB0NAVRAN', '1995-09-02', true),
  ('10250043100797', 'Nikhil Ashok Rane',     '9826010009', 'Surat - Ring Road',       'BARB0RINGRD', '1988-01-25', true),
  ('10250043100798', 'Pooja Harish Bhatia',   '9826010010', 'Vadodara - Alkapuri',     'BARB0ALKAPU', '1992-04-14', true),
  ('10250043100799', 'Sameer Kiran Pandya',   '9826010011', 'Rajkot - Kalawad Rd',     'BARB0KALAWD', '1985-07-08', true),
  ('10250043100800', 'Ritu Manoh Agarwal',    '9826010012', 'Gandhinagar - Sector 11', 'BARB0GANDHI', '1996-11-21', true),
  ('10250043100801', 'Gaurav Nitin Thakkar',  '9826010013', 'Bharuch - Station Rd',    'BARB0BHARUC', '1984-03-03', true),
  ('10250043100802', 'Ishita Bharat Solanki', '9826010014', 'Ahmedabad - Bodakdev',    'BARB0BODAKD', '1997-02-28', true),
  ('10250043100803', 'Manish Girish Parekh',  '9826010015', 'Ahmedabad - Navrangpura', 'BARB0NAVRAN', '1983-06-12', true),
  ('10250043100804', 'Tanvi Alok Shukla',     '9826010016', 'Surat - Ring Road',       'BARB0RINGRD', '1998-10-09', true),
  ('10250043100805', 'Rahul Mahesh Bhandari', '9826010017', 'Vadodara - Alkapuri',     'BARB0ALKAPU', '1990-08-17', true),
  ('10250043100806', 'Neelam Suresh Kapoor',  '9826010018', 'Rajkot - Kalawad Rd',     'BARB0KALAWD', '1986-12-26', true),
  ('10250043100807', 'Varun Dilip Sethi',     '9826010019', 'Gandhinagar - Sector 11', 'BARB0GANDHI', '1994-05-05', true),
  ('10250043100808', 'Lakshmi Ravi Krishnan', '9826010020', 'Bharuch - Station Rd',    'BARB0BHARUC', '1991-09-29', true)
ON CONFLICT DO NOTHING;
