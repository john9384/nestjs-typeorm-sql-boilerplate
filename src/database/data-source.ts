import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../config/database-options';

export default new DataSource(databaseOptions(process.env));
