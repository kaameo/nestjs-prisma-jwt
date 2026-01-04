import * as dotenv from 'dotenv';

export default async () => {
  // E2E 테스트 시작 전에 .env 파일을 명시적으로 로드
  dotenv.config();

  console.log('✅ Environment variables loaded for E2E tests');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 40) + '...');
  console.log('  JWT_SECRET:', process.env.JWT_SECRET?.substring(0, 20) + '...');
  console.log('  PORT:', process.env.PORT);
};
