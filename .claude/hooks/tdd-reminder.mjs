let data = '';
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const input = JSON.parse(data);
    filePath = input.tool_input?.file_path ?? '';
  } catch {
    return;
  }

  const isSourceFile = /\.(ts|tsx)$/.test(filePath);
  const isTestFile = /\.(test|spec)\.(ts|tsx)$/.test(filePath);

  if (!isSourceFile || isTestFile) return;

  const message =
    `TDD 체크: ${filePath} 생성 감지. ` +
    'AGENTS.md의 Test Boundary 및 ~/.claude/rules/tdd.md 규칙에 따라 ' +
    '(1) 이 파일보다 먼저 실패하는 테스트(RED)를 작성했는지, ' +
    '(2) 테스트 없이 프로덕션 코드부터 작성하지 않았는지 확인하세요. ' +
    '타입 정의·설정 파일·순수 UI/뷰 등 TDD 예외 대상이면 무시해도 됩니다.';

  console.log(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: message,
      },
    })
  );
});
