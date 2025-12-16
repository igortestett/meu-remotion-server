import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import dotenv from "dotenv";
dotenv.config();

const region = process.env.REMOTION_AWS_REGION || "us-east-2";
const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
const logGroupName = `/aws/lambda/${functionName}`;

const client = new CloudWatchLogsClient({ region });

async function checkLogs() {
  console.log(`🔎 Buscando logs para: ${logGroupName}`);
  
  try {
    // 1. Pegar o stream mais recente
    const streamsCmd = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: "LastEventTime",
      descending: true,
      limit: 1
    });
    
    const streamsRes = await client.send(streamsCmd);
    if (!streamsRes.logStreams || streamsRes.logStreams.length === 0) {
      console.log("⚠️ Nenhum log stream encontrado.");
      return;
    }

    const lastStream = streamsRes.logStreams[0];
    console.log(`📅 Última atividade: ${new Date(lastStream.lastEventTimestamp).toLocaleString()}`);
    console.log(`ID do Stream: ${lastStream.logStreamName}`);

    // 2. Ler os eventos desse stream
    const eventsCmd = new GetLogEventsCommand({
      logGroupName,
      logStreamName: lastStream.logStreamName,
      limit: 20,
      startFromHead: false 
    });

    const eventsRes = await client.send(eventsCmd);
    
    console.log("\n--- ÚLTIMOS LOGS DA LAMBDA ---");
    eventsRes.events.forEach(e => {
      console.log(`[${new Date(e.timestamp).toLocaleTimeString()}] ${e.message.trim()}`);
    });
    console.log("------------------------------\n");

  } catch (err) {
    console.error("❌ Erro ao buscar logs:", err.message);
  }
}

checkLogs();