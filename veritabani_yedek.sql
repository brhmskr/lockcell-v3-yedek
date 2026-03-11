--
-- PostgreSQL database dump
--

\restrict MTrQhCLn2FkklVB7YGPoTEaV5BX51UaKtGLsMjFhQVAyfFXEWxTZWqabSd3IWqQ

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: machine_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.machine_status AS ENUM (
    'running',
    'idle',
    'stopped',
    'broken'
);


--
-- Name: production_log_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.production_log_status AS ENUM (
    'running',
    'paused',
    'completed'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'operator'
);


--
-- Name: work_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_order_status AS ENUM (
    'pending',
    'in_progress',
    'completed'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    category text NOT NULL,
    amount numeric NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    amount_tl numeric,
    exchange_rate numeric,
    amount_eur numeric
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.expenses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    status public.machine_status DEFAULT 'idle'::public.machine_status NOT NULL,
    current_operator_id integer,
    current_stop_reason_id integer,
    status_changed_at timestamp without time zone DEFAULT now(),
    hourly_cost numeric DEFAULT '0'::numeric NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.machines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.machines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: operation_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_machines (
    id integer NOT NULL,
    operation_id integer NOT NULL,
    machine_id integer NOT NULL
);


--
-- Name: operation_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.operation_machines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.operation_machines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operations (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: operations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.operations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.operations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: production_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_logs (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    operation_id integer NOT NULL,
    machine_id integer NOT NULL,
    user_id integer NOT NULL,
    start_time timestamp without time zone DEFAULT now(),
    end_time timestamp without time zone,
    produced_quantity integer DEFAULT 0 NOT NULL,
    status public.production_log_status DEFAULT 'running'::public.production_log_status NOT NULL
);


--
-- Name: production_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.production_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.production_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: stop_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stop_logs (
    id integer NOT NULL,
    production_log_id integer NOT NULL,
    stop_reason_id integer NOT NULL,
    start_time timestamp without time zone DEFAULT now(),
    end_time timestamp without time zone
);


--
-- Name: stop_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stop_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stop_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stop_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stop_reasons (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL
);


--
-- Name: stop_reasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stop_reasons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stop_reasons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    full_name text NOT NULL,
    role public.user_role DEFAULT 'operator'::public.user_role NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id integer NOT NULL,
    order_number text NOT NULL,
    product_name text NOT NULL,
    target_quantity integer NOT NULL,
    completed_quantity integer DEFAULT 0 NOT NULL,
    operation_route integer[] NOT NULL,
    current_operation_index integer DEFAULT 0 NOT NULL,
    status public.work_order_status DEFAULT 'pending'::public.work_order_status NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    target_price numeric DEFAULT '0'::numeric NOT NULL
);


--
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.work_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.work_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, category, amount, month, year, description, created_at, amount_tl, exchange_rate, amount_eur) FROM stdin;
1	Elektrik	12000	2	2026	\N	2026-02-25 21:56:28.35287	\N	\N	\N
2	Su	96.50	2	2026	\N	2026-02-26 09:41:57.646022	5000	51.811046	96.50
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machines (id, name, code, status, current_operator_id, current_stop_reason_id, status_changed_at, hourly_cost, sort_order) FROM stdin;
3	Torna 1	TORNA-1	stopped	4	3	2026-02-25 07:39:17.888	0	0
2	CNC Freze 2	CNC-2	idle	\N	\N	2026-02-25 08:03:49.661	0	0
1	CNC Freze 1	CNC-1	idle	\N	\N	2026-02-25 08:38:38.484	0	0
5	Taslama 1	TASLAMA-1	idle	\N	\N	2026-02-25 09:19:06.078	0	0
6	Kalite Kontrol	QC-1	stopped	3	4	2026-02-25 09:29:19.708	0	0
4	Torna 2	TORNA-2	idle	\N	\N	2026-02-25 09:40:28.604	0	0
\.


--
-- Data for Name: operation_machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operation_machines (id, operation_id, machine_id) FROM stdin;
1	1	1
2	1	2
3	2	3
4	2	4
5	3	1
6	3	2
7	4	5
8	5	6
\.


--
-- Data for Name: operations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operations (id, name, code, description, sort_order) FROM stdin;
1	Kesim	OP10	Ham malzeme kesim operasyonu	0
2	Torna	OP20	Torna talaslı imalat operasyonu	0
3	Freze	OP30	CNC freze operasyonu	0
4	Taslama	OP40	Yuzey taslama operasyonu	0
5	Kalite Kontrol	OP60	Son kalite kontrol operasyonu	0
6	Tel Erezyon	OP50	Tel Kesim	0
\.


--
-- Data for Name: production_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.production_logs (id, work_order_id, operation_id, machine_id, user_id, start_time, end_time, produced_quantity, status) FROM stdin;
1	1	1	1	2	2026-02-25 07:10:14.778	2026-02-25 07:10:40.973	12	completed
2	2	1	2	2	2026-02-25 07:13:00.966	2026-02-25 07:13:39.841	18	completed
3	2	3	1	2	2026-02-25 07:29:18.156	2026-02-25 07:29:37.434	19	completed
4	3	1	1	2	2026-02-25 07:35:05.636	2026-02-25 07:35:11.475	8	completed
5	3	1	1	2	2026-02-25 07:37:21.772	2026-02-25 07:37:23.096	15	completed
6	1	2	3	4	2026-02-25 07:38:58.734	\N	0	paused
7	4	1	1	2	2026-02-25 08:00:18.168	2026-02-25 08:01:03.244	99	completed
8	4	3	2	2	2026-02-25 08:01:21.702	2026-02-25 08:01:44.793	99	completed
9	5	1	2	3	2026-02-25 08:03:25.311	2026-02-25 08:03:49.658	10	completed
11	1	2	1	2	2026-02-25 08:38:33.426	2026-02-25 08:38:38.48	10	completed
10	5	4	5	3	2026-02-25 08:05:17.19	2026-02-25 09:19:06.074	10	completed
12	2	5	6	3	2026-02-25 09:28:57.213	\N	0	paused
13	1	4	4	2	2026-02-25 09:40:28.351	2026-02-25 09:40:28.601	8	completed
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
h-B3OYDUikq0DABZypxl7gBSCxoQ1D4K	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-27T09:34:53.454Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 09:34:54
VO8ixOm9Oy3SMx5Mb8-Izm9Tyq96Z6YE	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-27T09:29:33.988Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 11:53:43
XF7Aa6Y-JkwHE63r1wHaAmVE-8pYnJLn	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-27T09:36:02.495Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 09:36:03
RP-b8-xsBAshEcNThDnsdD-SxiJs1O3W	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-26T21:58:19.237Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-26 21:58:20
9LLZfZ0q6bdzraKb3BGFny3QDbxakjXL	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-26T21:52:45.069Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 11:53:43
VaBGroYrtMb40ZTNJkyDDpisPa4Wv9Th	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-27T07:15:52.037Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 07:15:58
qgf15TEPXnou_7pQdDpjOgKnLHWNen-p	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-27T09:29:39.512Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 09:29:40
rneoQknxWmRZSNTkAY4t7y5oTCasIXIt	{"cookie":{"originalMaxAge":86400000,"expires":"2026-02-27T09:29:48.208Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"userId":1,"userRole":"admin"}	2026-02-27 09:29:49
\.


--
-- Data for Name: stop_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stop_logs (id, production_log_id, stop_reason_id, start_time, end_time) FROM stdin;
1	1	1	2026-02-25 07:10:23.132	2026-02-25 07:10:29.206
2	2	2	2026-02-25 07:13:09.791	2026-02-25 07:13:24.544
3	3	3	2026-02-25 07:29:25.101	2026-02-25 07:29:29.786
4	4	2	2026-02-25 07:35:11.379	2026-02-25 07:35:11.425
5	5	1	2026-02-25 07:37:22.904	2026-02-25 07:37:23.05
6	6	3	2026-02-25 07:39:17.884	\N
7	7	1	2026-02-25 08:00:38.049	2026-02-25 08:00:49.796
8	8	2	2026-02-25 08:01:29.604	2026-02-25 08:01:36.149
9	9	3	2026-02-25 08:03:30.548	2026-02-25 08:03:42.475
10	12	4	2026-02-25 09:29:19.705	\N
11	13	1	2026-02-25 09:40:28.422	2026-02-25 09:40:28.509
\.


--
-- Data for Name: stop_reasons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stop_reasons (id, name, code) FROM stdin;
1	Ariza	ariza
2	Malzeme Bekleme	malzeme
3	Mola	mola
4	Setup / Ayar	setup
5	Kalip Degisimi	kalip
6	Plansiz Duruş	plansiz
8	Diğer	diger
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password, full_name, role) FROM stdin;
1	admin	4215d41bfa47d128590ef304b0167d1e:5ea3bdaec5790e6eab5e41d844f9e3c11d6ad5cf5602f7c7fdc56d042e5870b5b9524d919a2f87e0b1eed1e3b2210202d3b62c2d29bc0e36e4fd767b50c7832f	Ahmet Yilmaz	admin
2	op1	a34b9ca6e4b9aef16140eec2ed83e812:62b32c52e96c37bacd39c83f5126e5019d78ef232a1fb3a5877648a36bf766b3eec27fae32fc2fa7a0d982d94853d80455ee55521853dd968bb6ce3e9153f269	Mehmet Demir	operator
3	op2	4d226bde3b1284bf167014aabe833ea0:03c5f608668e89dc0f2b6a2f33ccce3f63f89e5e2719b04005db0964c99b61f9c365b4590f8901bc64671d115a9a549ad73cddbf70d1df714b35fb5e45034eb6	Ayse Kaya	operator
4	op3	32dd592d5c3e306877c112b65b6af1a4:3360cd11e25b2edc9efdc148d9f3cbfd6b0a39ade3089f06be41b87e18241d33198f2ddee1b01f7e9b63e76b22d55c70f3ae3a9ba5556a6a0e89d316f04eda79	Ali Celik	operator
5	op4	e992fe1df5d273c5e8b554087133e387:2785167d933dae5ce36c7fd7ac2808894388c3483b94bf374e3686946bead4353b03d4b21a84d2e463bc9eff5e3797978d0d1019241ef47022dee17777fdf35f	Fatma Ozturk	operator
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_orders (id, order_number, product_name, target_quantity, completed_quantity, operation_route, current_operation_index, status, created_at, target_price) FROM stdin;
3	IE-2026-003	Rulman Yatagi	200	15	{1,2,3,4,5}	2	pending	2026-02-25 07:08:09.520514	0
4	IE-2026-005	Basınç Borusu	99	99	{1,3}	2	completed	2026-02-25 07:59:24.810218	0
5	IE-2026-006	Kulaklar	10	10	{1,4}	2	completed	2026-02-25 08:03:04.369349	0
2	IE-2026-002	Flanş Kapak	50	19	{1,3,5}	2	in_progress	2026-02-25 07:08:09.520514	0
1	IE-2026-001	Mil Saft 40mm	100	8	{1,2,4,5}	3	pending	2026-02-25 07:08:09.520514	0
7	EI-2006-14	Cam Kalıbı	100	0	{1,3,6,5}	0	pending	2026-02-25 21:55:42.354746	5000
\.


--
-- Name: expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expenses_id_seq', 2, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machines_id_seq', 7, true);


--
-- Name: operation_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.operation_machines_id_seq', 8, true);


--
-- Name: operations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.operations_id_seq', 6, true);


--
-- Name: production_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.production_logs_id_seq', 13, true);


--
-- Name: stop_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stop_logs_id_seq', 11, true);


--
-- Name: stop_reasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stop_reasons_id_seq', 8, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- Name: work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.work_orders_id_seq', 7, true);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: machines machines_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_code_unique UNIQUE (code);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: operation_machines operation_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_machines
    ADD CONSTRAINT operation_machines_pkey PRIMARY KEY (id);


--
-- Name: operations operations_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_code_unique UNIQUE (code);


--
-- Name: operations operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_pkey PRIMARY KEY (id);


--
-- Name: production_logs production_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_logs
    ADD CONSTRAINT production_logs_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: stop_logs stop_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stop_logs
    ADD CONSTRAINT stop_logs_pkey PRIMARY KEY (id);


--
-- Name: stop_reasons stop_reasons_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stop_reasons
    ADD CONSTRAINT stop_reasons_code_unique UNIQUE (code);


--
-- Name: stop_reasons stop_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stop_reasons
    ADD CONSTRAINT stop_reasons_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: work_orders work_orders_order_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_order_number_unique UNIQUE (order_number);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- PostgreSQL database dump complete
--

\unrestrict MTrQhCLn2FkklVB7YGPoTEaV5BX51UaKtGLsMjFhQVAyfFXEWxTZWqabSd3IWqQ

