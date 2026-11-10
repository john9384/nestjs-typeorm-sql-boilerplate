import { registerAs } from '@nestjs/config';
import { databaseOptions } from './database-options';

export default registerAs('database', () => databaseOptions(process.env));
