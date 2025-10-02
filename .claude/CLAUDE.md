# Project-Specific Rules for Claude Code

## 🚨 CRITICAL SAFETY RULES 🚨

### Never Kill Processes You Didn't Start

**STRICT RULE**: Only kill processes that were started in THIS SESSION by you (Claude).

**Why**: User has multiple Claude Code sessions and localhost servers running. Killing random node/npm/vite processes will crash other sessions and servers.

**How to Follow This Rule**:

1. **Track what you start**: When you run a background command, note the shell ID
2. **Only kill your own shells**: Use `KillShell` tool with shell IDs YOU created
3. **Never use these commands**:
   - ❌ `pkill node`
   - ❌ `pkill npm`
   - ❌ `taskkill /F /IM node.exe`
   - ❌ `Stop-Process -Name node`
   - ❌ Any command that kills processes by name/pattern

4. **Safe alternatives**:
   - ✅ `KillShell <shell_id>` for shells you started
   - ✅ Track PIDs when you start processes, only kill those specific PIDs
   - ✅ Ask user to manually restart if you can't safely identify your processes

**Example of Safe Process Management**:
```bash
# ✅ GOOD: You started this shell
npm run dev:server  # Creates shell ID: abc123
# Later...
KillShell abc123  # Safe - you started it

# ❌ BAD: Don't know who started these
netstat -ano | findstr :3001  # Shows PID 12345
taskkill /PID 12345  # UNSAFE - might be another session's server
```

**If Port Conflicts Occur**:
1. Ask user to manually restart the conflicting server
2. Or suggest using a different port for this project
3. Never assume you can safely kill the process on that port

---

## Development Server Management

### This Project's Servers
- **Backend**: `npm run dev:server` (port 3001)
- **Frontend**: `npm run dev` (port 3000)

### Server Restart Protocol
1. Use `KillShell` on shell IDs you created
2. Wait 2-3 seconds for ports to be released
3. Start new servers with `npm run` commands
4. If port conflicts persist, ask user for help

---

## Performance Optimization Notes

### Completed Optimizations (2025-10-02)
- Database connection pool configuration
- Invoice route parallel query execution
- React Query request deduplication

### Known Issues
- Server auto-reload doesn't always trigger
- Manual restarts needed after some TypeScript changes
