import { KinDB } from './schema';

/** App-wide database instance. Only db/repositories may import this (SPEC §4). */
export const db = new KinDB();
