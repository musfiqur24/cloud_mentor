import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { awsClients, runtimeConfig } from '../config/runtime.mjs';

export async function saveHistory({ type, title, request, result, resultData = null }) {
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const item = {
    userId: runtimeConfig.demoUserId,
    createdAtId: `${createdAt}#${id}`,
    id,
    type,
    title,
    request,
    result,
    resultData,
    createdAt
  };

  if (runtimeConfig.useLocalHistory) {
    await saveLocalHistory(item);
    return item;
  }

  await awsClients.document.send(new PutCommand({
    TableName: runtimeConfig.tableName,
    Item: item
  }));

  return item;
}

export async function saveProgress(payload) {
  const score = Number(payload.score || 0);
  return saveHistory({
    type: 'progress',
    title: `Progress: ${payload.topic || 'Study session'}`,
    request: safeRequest(payload),
    result: JSON.stringify({
      topic: payload.topic || 'General',
      score: Number.isFinite(score) ? score : 0,
      note: payload.note || '',
      completedAt: new Date().toISOString()
    }, null, 2)
  });
}

export async function getHistory(limit) {
  if (runtimeConfig.useLocalHistory) {
    const items = await readLocalHistory();
    return items
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit)
      .map(formatHistoryItem);
  }

  const result = await awsClients.document.send(new QueryCommand({
    TableName: runtimeConfig.tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': runtimeConfig.demoUserId
    },
    ScanIndexForward: false,
    Limit: limit
  }));

  return (result.Items || []).map(formatHistoryItem);
}

function formatHistoryItem(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    result: item.result,
    resultData: item.resultData || null,
    createdAt: item.createdAt
  };
}

async function readLocalHistory() {
  try {
    const raw = await fs.readFile(runtimeConfig.localHistoryFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveLocalHistory(item) {
  const items = await readLocalHistory();
  items.push(item);
  await fs.mkdir(path.dirname(runtimeConfig.localHistoryFile), { recursive: true });
  await fs.writeFile(runtimeConfig.localHistoryFile, JSON.stringify(items.slice(-100), null, 2));
}

function safeRequest(payload) {
  const copy = { ...payload };
  if (copy.notes && copy.notes.length > 1000) {
    copy.notes = `${copy.notes.slice(0, 1000)}...`;
  }
  return copy;
}
