# SuperClaude Prompt Syntax - Complete Reference

## Modes

| Mode | Description |
| :--- | :--- |
| **Brainstorming** | Collaborative discovery mindset for interactive requirements exploration and creative problem solving |
| **Business-Panel** | Multi-expert business analysis mode with adaptive interaction strategies and intelligent synthesis |
| **Introspection** | Meta-cognitive analysis mindset for self-reflection and reasoning optimization |
| **Orchestration** | Intelligent tool selection mindset for optimal task routing and resource efficiency |
| **Task-Management** | Hierarchical task organization with persistent memory for complex multi-step operations |
| **Token-Efficiency** | Symbol-enhanced communication mindset for compressed clarity and efficient token usage |

## Agents

| Agent | Description |
| :--- | :--- |
| **backend-architect** | Design reliable backend systems with focus on data integrity, security, and fault tolerance |
| **business-panel-experts** | Multi-expert business strategy panel synthesizing Christensen, Porter, Drucker, Godin, Kim & Mauborgne, Collins, Taleb, Meadows, and Doumont |
| **devops-architect** | Automate infrastructure and deployment processes with focus on reliability and observability |
| **frontend-architect** | Create accessible, performant user interfaces with focus on user experience and modern frameworks |
| **general-purpose** | General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks |
| **learning-guide** | Teach programming concepts and explain code with focus on understanding through progressive learning |
| **output-style-setup** | Create Claude Code output styles |
| **performance-engineer** | Optimize system performance through measurement-driven analysis and bottleneck elimination |
| **python-expert** | Deliver production-ready, secure, high-performance Python code following SOLID principles |
| **quality-engineer** | Ensure software quality through comprehensive testing strategies and systematic edge case detection |
| **refactoring-expert** | Improve code quality and reduce technical debt through systematic refactoring and clean code principles |
| **requirements-analyst** | Transform ambiguous project ideas into concrete specifications through systematic requirements discovery |
| **root-cause-analyst** | Systematically investigate complex problems to identify underlying causes through evidence-based analysis |
| **security-engineer** | Identify security vulnerabilities and ensure compliance with security standards and best practices |
| **socratic-mentor** | Educational guide specializing in Socratic method for programming knowledge with focus on discovery learning |
| **statusline-setup** | Configure Claude Code status line settings |
| **system-architect** | Design scalable system architecture with focus on maintainability and long-term technical decisions |
| **technical-writer** | Create clear, comprehensive technical documentation tailored to specific audiences |

## Commands (All use /sc: prefix)

| Command | Description |
| :--- | :--- |
| **/sc:analyze** | Comprehensive code analysis across quality, security, performance, and architecture domains |
| **/sc:brainstorm** | Interactive requirements discovery through Socratic dialogue and systematic exploration |
| **/sc:build** | Build, compile, and package projects with intelligent error handling and optimization |
| **/sc:business-panel** | AI facilitated panel discussion between renowned business thought leaders analyzing documents |
| **/sc:checkpoint** | Create intermediate session checkpoint |
| **/sc:cleanup** | Systematically clean up code, remove dead code, and optimize project structure |
| **/sc:design** | Design system architecture, APIs, and component interfaces with comprehensive specifications |
| **/sc:document** | Generate focused documentation for components, functions, APIs, and features |
| **/sc:estimate** | Provide development estimates for tasks, features, or projects with intelligent analysis |
| **/sc:explain** | Provide clear explanations of code, concepts, and system behavior with educational clarity |
| **/sc:git** | Git operations with intelligent commit messages and workflow optimization |
| **/sc:help** | List all available /sc commands and their functionality |
| **/sc:implement** | Feature and code implementation with intelligent persona activation and MCP integration |
| **/sc:improve** | Apply systematic improvements to code quality, performance, and maintainability |
| **/sc:index** | Generate comprehensive project documentation and knowledge base with intelligent organization |
| **/sc:load** | Session lifecycle management with Serena MCP integration for project context loading |
| **/sc:reflect** | Task reflection and validation using Serena MCP analysis capabilities |
| **/sc:save** | Session lifecycle management with Serena MCP integration for session context persistence |
| **/sc:select-tool** | Intelligent MCP tool selection based on complexity scoring and operation analysis |
| **/sc:spawn** | Meta-system task orchestration with intelligent breakdown and delegation |
| **/sc:spec-panel** | Multi-expert specification review and improvement using renowned specification experts |
| **/sc:task** | Execute complex tasks with intelligent workflow management and delegation |
| **/sc:test** | Execute tests with coverage analysis and automated quality reporting |
| **/sc:troubleshoot** | Diagnose and resolve issues in code, builds, deployments, and system behavior |
| **/sc:workflow** | Generate structured implementation workflows from PRDs and feature requirements |

## Essential Flags

### Behavioral Mode Flags

| Flag | Description |
| :--- | :--- |
| **--brainstorm** | Activate collaborative discovery mindset, ask probing questions, guide requirement elicitation |
| **--introspect** | Expose thinking process with transparency markers (🤔, 🎯, ⚡, 📊, 💡) |
| **--task-manage** | Orchestrate through delegation, progressive enhancement, systematic organization |
| **--orchestrate** | Optimize tool selection matrix, enable parallel thinking, adapt to resource constraints |
| **--token-efficient** | Symbol-enhanced communication, 30-50% token reduction while preserving clarity |

### MCP Server Flags

| Flag | Description |
| :--- | :--- |
| **--c7 / --context7** | Enable Context7 for curated documentation lookup and pattern guidance |
| **--seq / --sequential** | Enable Sequential for structured multi-step reasoning and hypothesis testing |
| **--magic** | Enable Magic for modern UI generation from 21st.dev patterns |
| **--morph / --morphllm** | Enable Morphllm for efficient multi-file pattern application |
| **--serena** | Enable Serena for semantic understanding and session persistence |
| **--play / --playwright** | Enable Playwright for real browser automation and testing |
| **--all-mcp** | Enable all MCP servers for comprehensive capability |
| **--no-mcp** | Disable all MCP servers, use native tools with WebSearch fallback |

### Analysis Depth Flags

| Flag | Description |
| :--- | :--- |
| **--think** | Standard structured analysis (~4K tokens), enables Sequential |
| **--think-hard** | Deep analysis (~10K tokens), enables Sequential + Context7 |
| **--ultrathink** | Maximum depth analysis (~32K tokens), enables all MCP servers |

### Execution Control Flags

| Flag | Description |
| :--- | :--- |
| **--delegate** `[auto|files|folders]` | Enable sub-agent parallel processing with intelligent routing |
| **--concurrency** `[n]` | Control max concurrent operations (range: 1-15) |
| **--loop** | Enable iterative improvement cycles with validation gates |
| **--iterations** `[n]` | Set improvement cycle count (range: 1-10) |
| **--validate** | Pre-execution risk assessment and validation gates |
| **--safe-mode** | Maximum validation, conservative execution, auto-enable --uc |

### Output Optimization Flags

| Flag | Description |
| :--- | :--- |
| **--uc / --ultracompressed** | Symbol communication system, 30-50% token reduction |
| **--scope** `[file|module|project|system]` | Define operational scope and analysis depth |
| **--focus** `[performance|security|quality|architecture|accessibility|testing]` | Target specific analysis domain and expertise application |

### Wave Mode Flags

| Flag | Description |
| :--- | :--- |
| **--wave** | Enable wave-based operations for large-scale tasks |
| **--wave-strategy** `[progressive|systematic|adaptive|enterprise]` | Wave execution strategy |
| **--wave-size** `[small|medium|large]` | Control wave operation scale |

### Business Panel Expert Flags

| Flag | Description |
| :--- | :--- |
| **--experts** `[christensen,porter,drucker,godin,kim_mauborgne,collins,taleb,meadows,doumont]` | Select specific experts |
| **--mode** `[discussion|debate|socratic]` | Panel interaction mode |
| **--synthesis-only** | Skip individual analysis, go straight to synthesis |

### Memory and Context Flags

| Flag | Description |
| :--- | :--- |
| **--remember** | Store important context for future sessions |
| **--forget** | Clear specific context or memory |
| **--context-size** `[small|medium|large]` | Control context window usage |

### Quality Control Flags

| Flag | Description |
| :--- | :--- |
| **--dry-run** | Show what would be done without executing |
| **--backup** | Create backup before making changes |
| **--rollback** | Revert previous changes |
| **--verify** | Verify changes after execution |

### Integration Flags

| Flag | Description |
| :--- | :--- |
| **--git-smart** | Intelligent git operations with context |
| **--ci-cd** | Integrate with CI/CD pipeline |
| **--docker** | Docker-aware operations |

## Flag Priority Rules

| Rule | Description |
| :--- | :--- |
| **Safety First** | --safe-mode > --validate > optimization flags |
| **Explicit Override** | User flags > auto-detection |
| **Depth Hierarchy** | --ultrathink > --think-hard > --think |
| **MCP Control** | --no-mcp overrides all individual MCP flags |
| **Scope Precedence** | system > project > module > file |

## Command-Specific Flags

### Analysis Command Flags (/sc:analyze)

| Flag | Description |
| :--- | :--- |
| **--focus** `[performance|security|quality|architecture|accessibility|testing]` | Target specific domain |
| **--depth** `[quick|deep]` | Analysis thoroughness |
| **--format** `[text|json|report]` | Output format |

### Build Command Flags (/sc:build)

| Flag | Description |
| :--- | :--- |
| **--type** `[dev|prod|test]` | Build configuration |
| **--clean** | Clean before build |
| **--optimize** | Enable optimizations |
| **--verbose** | Detailed output |

### Design Command Flags (/sc:design)

| Flag | Description |
| :--- | :--- |
| **--type** `[architecture|api|component|database]` | Design target |
| **--format** `[diagram|spec|code]` | Output format |

### Improve Command Flags (/sc:improve)

| Flag | Description |
| :--- | :--- |
| **--type** `[quality|performance|maintainability|style|security]` | Improvement focus |
| **--safe** | Conservative approach |
| **--interactive** | User guidance |
| **--preview** | Show without executing |

### Task Command Flags (/sc:task)

| Flag | Description |
| :--- | :--- |
| **--strategy** `[systematic|agile|enterprise]` | Task approach |
| **--parallel** | Parallel execution |
| **--delegate** | Sub-agent coordination |

### Workflow Command Flags (/sc:workflow)

| Flag | Description |
| :--- | :--- |
| **--strategy** `[systematic|agile|enterprise]` | Workflow approach |
| **--depth** `[shallow|normal|deep]` | Analysis depth |
| **--parallel** | Parallel coordination |

### Troubleshoot Command Flags (/sc:troubleshoot)

| Flag | Description |
| :--- | :--- |
| **--type** `[bug|build|performance|deployment]` | Issue category |
| **--trace** | Include trace analysis |
| **--fix** | Apply fixes |

### Cleanup Command Flags (/sc:cleanup)

| Flag | Description |
| :--- | :--- |
| **--type** `[code|imports|files|all]` | Cleanup target |
| **--safe / --aggressive** | Cleanup intensity |
| **--interactive** | User guidance |
| **--preview** | Show without executing |

### Estimate Command Flags (/sc:estimate)

| Flag | Description |
| :--- | :--- |
| **--type** `[time|effort|complexity]` | Estimate focus |
| **--unit** `[hours|days|weeks]` | Time unit |
| **--breakdown** | Detailed breakdown |

### Index Command Flags (/sc:index)

| Flag | Description |
| :--- | :--- |
| **--type** `[docs|api|structure|readme]` | Index target |
| **--format** `[md|json|yml]` | Output format |

### Reflect Command Flags (/sc:reflect)

| Flag | Description |
| :--- | :--- |
| **--type** `[task|session|completion]` | Reflection scope |
| **--analyze** | Include analysis |
| **--validate** | Validate completeness |

### Spawn Command Flags (/sc:spawn)

| Flag | Description |
| :--- | :--- |
| **--strategy** `[sequential|parallel|adaptive]` | Coordination approach |
| **--depth** `[normal|deep]` | Analysis depth |

### Git Command Flags (/sc:git)

| Flag | Description |
| :--- | :--- |
| **--smart-commit** | Generate commit message |
| **--interactive** | Guided operations |

### Select-Tool Command Flags (/sc:select-tool)

| Flag | Description |
| :--- | :--- |
| **--analyze** | Tool analysis |
| **--explain** | Explain selection |

### Test Command Flags (/sc:test)

| Flag | Description |
| :--- | :--- |
| **--coverage** | Include coverage |
| **--type** `[unit|integration|e2e]` | Test type |
| **--watch** | Watch mode |

## Persona Flags

| Flag | Description |
| :--- | :--- |
| **--persona-architect** | Activates the Architect persona for system design and high-level planning |
| **--persona-security** | Activates the Security persona for threat modeling and secure code practices |
| **--persona-backend** | Activates the Backend persona for API reliability and scalability |
| **--persona-frontend** | Activates the Frontend persona for UI/UX development and polish |
| **--persona-qa** | Activates the QA persona for test strategy and coverage |
| **--persona-performance** | Activates the Performance persona for speed tuning and optimization |
| **--persona-refactorer** | Activates the Refactorer persona for code clarity and cleanup |
| **--persona-mentor** | Activates the Mentor persona for guided learning and coaching |
| **--persona-analyzer** | Activates the Analyzer persona for deep-dive debugging and root cause analysis |
| **--persona-scribe** | Focuses on technical writing, documentation, and clear communication |

## Business Panel Expert Profiles

| Expert | Framework/Focus | Key Concepts |
| :--- | :--- | :--- |
| **christensen** | Disruption Theory, Jobs-to-be-Done | Innovation, market disruption |
| **porter** | Competitive Strategy, Five Forces | Competitive advantage, value chain |
| **drucker** | Management Fundamentals | Effectiveness, customer focus |
| **godin** | Purple Cow, Permission Marketing | Remarkability, tribe building |
| **kim_mauborgne** | Blue Ocean Strategy | Value innovation, uncontested markets |
| **collins** | Good to Great, Built to Last | Excellence, disciplined execution |
| **taleb** | Antifragile, Black Swan | Risk, uncertainty, robustness |
| **meadows** | Systems Thinking | Leverage points, system dynamics |
| **doumont** | Clear Communication | Message clarity, audience focus |

## Example Usage Patterns

### Complex Analysis
```
/sc:analyze @codebase --ultrathink --focus performance --persona-architect
```

### Business Strategy Review
```
/sc:business-panel @strategy.pdf --experts "porter,christensen,collins" --mode debate
```

### Large-Scale Refactoring
```
/sc:improve @project --wave --strategy systematic --safe --backup
```

### Session Management
```
/sc:load @project
/sc:task "implement feature X" --delegate --parallel
/sc:checkpoint
/sc:save
```

### Multi-Expert Consultation
```
/sc:spawn "architecture review" --strategy parallel --depth deep --persona-architect,security,performance
```