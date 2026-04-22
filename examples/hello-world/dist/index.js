export async function run(input, ctx) {
  const name = input?.name || "World";
  
  ctx.logger.info("Running hello-world agent", { name });
  
  const echoResult = await ctx.tools["echo.text"]({ text: `Hello, ${name}!` });
  
  return {
    message: echoResult.text,
    agent: ctx.agent.name,
    version: ctx.agent.version,
  };
}
