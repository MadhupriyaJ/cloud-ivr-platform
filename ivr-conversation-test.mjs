#!/usr/bin/env node
/**
 * IVR Conversation Tester - Interactive CLI
 * 
 * Run: node ivr-conversation-test.mjs
 * 
 * This script simulates a real phone call to the IVR system.
 * You select a domain, then have a back-and-forth conversation
 * with the IVR engine just like a real caller would.
 */

import * as readline from 'readline';

const API_BASE = process.env.API_BASE || 'http://localhost:8010/api';

// ─── Colors for terminal output ───
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';
const BG_BLUE = '\x1b[44m';
const BG_GREEN = '\x1b[42m';

// ─── API Helper ───
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ─── UI Helpers ───
function printBanner() {
  console.log('');
  console.log(`${BG_BLUE}${WHITE}${BOLD}  ╔══════════════════════════════════════════════╗  ${RESET}`);
  console.log(`${BG_BLUE}${WHITE}${BOLD}  ║     IVR CONVERSATION TESTER - Interactive     ║  ${RESET}`);
  console.log(`${BG_BLUE}${WHITE}${BOLD}  ║        Generic IVR Engine v1.0                ║  ${RESET}`);
  console.log(`${BG_BLUE}${WHITE}${BOLD}  ╚══════════════════════════════════════════════╝  ${RESET}`);
  console.log('');
}

function printIvrMessage(step) {
  const nodeInfo = step.nodeCode ? `${DIM}[${step.nodeCode} | ${step.nodeType}]${RESET}` : '';
  console.log('');
  console.log(`  ${GREEN}${BOLD}🤖 IVR System ${nodeInfo}${RESET}`);
  console.log(`  ${GREEN}┌─────────────────────────────────────────────────────┐${RESET}`);
  
  // Word-wrap the prompt text
  const words = step.promptText.split(' ');
  let line = '  ';
  const maxLen = 50;
  for (const word of words) {
    if (line.length + word.length > maxLen + 4) {
      console.log(`  ${GREEN}│${RESET} ${line.trim().padEnd(maxLen)} ${GREEN}│${RESET}`);
      line = '  ';
    }
    line += word + ' ';
  }
  if (line.trim()) {
    console.log(`  ${GREEN}│${RESET} ${line.trim().padEnd(maxLen)} ${GREEN}│${RESET}`);
  }
  console.log(`  ${GREEN}└─────────────────────────────────────────────────────┘${RESET}`);
}

function printUserMessage(text) {
  console.log('');
  console.log(`  ${BLUE}${BOLD}👤 You:${RESET} ${CYAN}${text}${RESET}`);
}

function printVariables(variables) {
  const filtered = Object.entries(variables || {}).filter(([k]) => !k.startsWith('_'));
  if (filtered.length === 0) return;
  console.log(`  ${DIM}📋 Collected data:${RESET}`);
  for (const [key, val] of filtered) {
    console.log(`     ${YELLOW}${key}${RESET}: ${WHITE}${val}${RESET}`);
  }
}

function printSessionInfo(sessionId, domainCode, status) {
  console.log(`  ${DIM}─────────────────────────────────────────────────${RESET}`);
  console.log(`  ${DIM}Session: ${sessionId}${RESET}`);
  console.log(`  ${DIM}Domain:  ${domainCode} | Status: ${status}${RESET}`);
  console.log(`  ${DIM}─────────────────────────────────────────────────${RESET}`);
}

function printHelp() {
  console.log('');
  console.log(`  ${BOLD}Available Commands:${RESET}`);
  console.log(`  ${CYAN}/help${RESET}      - Show this help`);
  console.log(`  ${CYAN}/state${RESET}     - Show current session state & variables`);
  console.log(`  ${CYAN}/end${RESET}       - End the current call`);
  console.log(`  ${CYAN}/restart${RESET}   - Restart with same domain`);
  console.log(`  ${CYAN}/switch${RESET}    - Switch to a different domain`);
  console.log(`  ${CYAN}/quit${RESET}      - Exit the tester`);
  console.log(`  ${DIM}Or just type your response to talk to the IVR.${RESET}`);
  console.log('');
}

// ─── Main Interactive Loop ───
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  printBanner();

  // Check backend health
  try {
    const health = await api('/ivr-engine/health');
    console.log(`  ${BG_GREEN}${WHITE} ✓ Engine connected ${RESET} ${DIM}${health.engine.flows} flows, ${health.engine.nodes} nodes, ${health.engine.endpoints} endpoints${RESET}`);
  } catch (e) {
    console.log(`  ${RED}✗ Cannot connect to IVR Engine at ${API_BASE}${RESET}`);
    console.log(`  ${RED}  Make sure the NestJS backend is running on port 8010${RESET}`);
    rl.close();
    return;
  }

  // Fetch available domains
  let flows;
  try {
    flows = await api('/ivr-engine/flows');
  } catch (e) {
    console.log(`  ${RED}✗ Cannot fetch flows: ${e.message}${RESET}`);
    rl.close();
    return;
  }

  // Extract unique domains from flows
  const domainMap = new Map();
  for (const f of flows) {
    if (!domainMap.has(f.DomainCode)) {
      domainMap.set(f.DomainCode, f.DomainName || f.DomainCode);
    }
  }
  const domainList = [...domainMap.entries()];

  async function selectDomain() {
    console.log('');
    console.log(`  ${BOLD}Available Domains:${RESET}`);
    domainList.forEach(([code, name], i) => {
      console.log(`    ${YELLOW}${i + 1}${RESET}. ${name} ${DIM}(${code})${RESET}`);
    });
    console.log('');

    while (true) {
      const choice = await ask(`  ${MAGENTA}Select domain (1-${domainList.length}): ${RESET}`);
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < domainList.length) {
        return domainList[idx][0]; // return domainCode
      }
      console.log(`  ${RED}Invalid choice. Enter a number 1-${domainList.length}.${RESET}`);
    }
  }

  // ─── Conversation Loop ───
  let running = true;
  while (running) {
    const domainCode = await selectDomain();
    console.log('');
    console.log(`  ${BOLD}📞 Dialing ${domainMap.get(domainCode)}...${RESET}`);
    console.log(`  ${DIM}(Type /help for commands, or just type your response)${RESET}`);

    let sessionId = null;
    let sessionStatus = 'idle';
    let currentVariables = {};

    // Start session
    try {
      const result = await api('/ivr-engine/session/start', {
        method: 'POST',
        body: JSON.stringify({ domainCode }),
      });
      sessionId = result.sessionId;
      sessionStatus = result.status;
      printSessionInfo(sessionId, domainCode, sessionStatus);
      printIvrMessage(result.step);
    } catch (e) {
      console.log(`  ${RED}✗ Failed to start session: ${e.message}${RESET}`);
      continue;
    }

    // Conversation loop
    let inCall = true;
    while (inCall && sessionId) {
      const input = await ask(`\n  ${BLUE}You > ${RESET}`);
      const trimmed = input.trim();

      if (!trimmed) continue;

      // Handle commands
      if (trimmed.startsWith('/')) {
        const cmd = trimmed.toLowerCase();
        if (cmd === '/help') {
          printHelp();
          continue;
        }
        if (cmd === '/state') {
          try {
            const state = await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}`);
            console.log('');
            console.log(`  ${BOLD}Session State:${RESET}`);
            console.log(`  ${DIM}Session ID:${RESET}   ${state.sessionId}`);
            console.log(`  ${DIM}Domain:${RESET}       ${state.domainCode}`);
            console.log(`  ${DIM}Current Node:${RESET} ${state.currentNode}`);
            console.log(`  ${DIM}Status:${RESET}       ${state.status}`);
            console.log(`  ${DIM}Duration:${RESET}     ${state.durationMs}ms`);
            console.log(`  ${DIM}History:${RESET}      ${(state.history || []).length} steps`);
            printVariables(state.variables);
          } catch (e) {
            console.log(`  ${RED}Error: ${e.message}${RESET}`);
          }
          continue;
        }
        if (cmd === '/end') {
          try {
            await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/end`, { method: 'POST' });
            console.log(`\n  ${YELLOW}📞 Call ended.${RESET}`);
            printVariables(currentVariables);
          } catch (e) {
            console.log(`  ${RED}Error ending session: ${e.message}${RESET}`);
          }
          inCall = false;
          continue;
        }
        if (cmd === '/restart') {
          try {
            await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/end`, { method: 'POST' }).catch(() => {});
          } catch (_) {}
          console.log(`\n  ${YELLOW}🔄 Restarting call...${RESET}`);
          try {
            const result = await api('/ivr-engine/session/start', {
              method: 'POST',
              body: JSON.stringify({ domainCode }),
            });
            sessionId = result.sessionId;
            sessionStatus = result.status;
            currentVariables = {};
            printSessionInfo(sessionId, domainCode, sessionStatus);
            printIvrMessage(result.step);
          } catch (e) {
            console.log(`  ${RED}✗ Failed to restart: ${e.message}${RESET}`);
            inCall = false;
          }
          continue;
        }
        if (cmd === '/switch') {
          try {
            await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/end`, { method: 'POST' }).catch(() => {});
          } catch (_) {}
          inCall = false;
          continue;
        }
        if (cmd === '/quit') {
          try {
            await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/end`, { method: 'POST' }).catch(() => {});
          } catch (_) {}
          running = false;
          inCall = false;
          continue;
        }
        console.log(`  ${RED}Unknown command: ${trimmed}. Type /help for commands.${RESET}`);
        continue;
      }

      // Send user input to IVR engine
      printUserMessage(trimmed);
      try {
        const result = await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/input`, {
          method: 'POST',
          body: JSON.stringify({ userInput: trimmed }),
        });
        sessionStatus = result.status;
        currentVariables = result.variables || {};

        printIvrMessage(result.step);
        printVariables(result.variables);

        if (result.status === 'completed') {
          console.log(`\n  ${YELLOW}📞 Call completed automatically.${RESET}`);
          inCall = false;
        }
      } catch (e) {
        console.log(`  ${RED}Error: ${e.message}${RESET}`);
      }
    }

    // After call ends
    if (running) {
      console.log('');
      const again = await ask(`  ${MAGENTA}Start another call? (y/n): ${RESET}`);
      if (again.toLowerCase() !== 'y') {
        running = false;
      }
    }
  }

  console.log('');
  console.log(`  ${BOLD}Thank you for using IVR Conversation Tester!${RESET}`);
  console.log('');
  rl.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
