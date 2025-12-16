import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import dotenv from "dotenv";

dotenv.config();

const region = process.env.REMOTION_AWS_REGION || "us-east-1";

console.log(`🔍 Testando conexão AWS na região: ${region}`);
console.log(`🔑 Chaves detectadas? AccessKey: ${!!process.env.AWS_ACCESS_KEY_ID}, Secret: ${!!process.env.AWS_SECRET_ACCESS_KEY}`);

const s3 = new S3Client({ region });
const lambda = new LambdaClient({ region });

async function test() {
  try {
    console.log("⏳ Tentando listar buckets S3...");
    const buckets = await s3.send(new ListBucketsCommand({}));
    console.log(`✅ S3 OK! Encontrados ${buckets.Buckets.length} buckets.`);
  } catch (e) {
    console.error("❌ FALHA S3:", e.message);
  }

  try {
    console.log("⏳ Tentando listar funções Lambda...");
    const functions = await lambda.send(new ListFunctionsCommand({ MaxItems: 5 }));
    console.log(`✅ Lambda OK! Encontradas ${functions.Functions.length} funções.`);
  } catch (e) {
    console.error("❌ FALHA Lambda:", e.message);
  }
}

test();
