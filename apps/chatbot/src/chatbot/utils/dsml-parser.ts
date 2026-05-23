/**
 * DSML (DeepSeek Message Language) Parser
 *
 * Parses DSML-format tool calls from LLM response text.
 * DSML format examples:
 * <｜｜DSML｜｜tool_calls>
 * <｜｜DSML｜｜invoke name="update_ticket">
 * <｜｜DSML｜｜parameter name="ticketId" string="true">TKT-123</｜｜DSML｜｜parameter>
 * </｜｜DSML｜｜invoke>
 * </｜｜DSML｜｜tool_calls>
 *
 * OR (without proper closing tags - LLM sometimes outputs this way):
 * <｜｜DSML｜｜tool_calls>
 * <｜｜DSML｜｜invoke name="create_ticket">
 * <｜｜DSML｜｜parameter name="title">...</｜｜DSML｜｜parameter>
 * </｜｜DSML｜｜invoke>
 */

export interface DSMLToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Parse DSML tool calls from response content
 */
export function parseDSMLToolCalls(content: string): DSMLToolCall[] {
  const toolCalls: DSMLToolCall[] = [];
  let callIndex = 0;

  // Strategy 1: Match DSML tool_calls block with closing tag (correct closing tag: </｜｜DSML｜｜tool_calls>)
  const toolCallsRegex = /<｜｜DSML｜｜tool_calls>[\s\S]*?<\/｜｜DSML｜｜tool_calls>/gi;
  let toolCallsMatch;

  while ((toolCallsMatch = toolCallsRegex.exec(content)) !== null) {
    const toolCallsBlock = toolCallsMatch[0];
    console.log('[DSMLParser] Found tool_calls block, parsing invokes...');
    parseInvokes(toolCallsBlock, toolCalls, () => `dsml_tool_${Date.now()}_${callIndex++}`);
  }

  // Strategy 2: If no tool_calls block found, look for individual invoke tags anywhere in content
  if (toolCalls.length === 0) {
    console.log('[DSMLParser] No tool_calls block found, looking for standalone invoke tags...');

    // Match all <｜｜DSML｜｜invoke ...>...</｜｜DSML｜｜invoke> blocks
    const standaloneInvokeRegex = /<｜｜DSML｜｜invoke name="([^"]+)"[^>]*>[\s\S]*?<\/｜｜DSML｜｜invoke>/gi;
    let invokeMatch;

    while ((invokeMatch = standaloneInvokeRegex.exec(content)) !== null) {
      const toolName = invokeMatch[1];
      const invokeContent = invokeMatch[2];

      console.log('[DSMLParser] Found standalone invoke:', toolName);

      // Parse parameters
      const arguments_: Record<string, any> = {};
      const paramRegex = /<｜｜DSML｜｜parameter name="([^"]+)"(?: string="true")?>([\s\S]*?)<\/｜｜DSML｜｜parameter>/gi;
      let paramMatch;

      while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
        const paramName = paramMatch[1];
        let paramValue: any = paramMatch[2].trim();

        // Try to parse as JSON if it looks like an object or array
        if (paramValue === 'true') {
          paramValue = true;
        } else if (paramValue === 'false') {
          paramValue = false;
        } else if (paramValue === 'null') {
          paramValue = null;
        } else if (/^\d+$/.test(paramValue)) {
          paramValue = parseInt(paramValue, 10);
        } else if (/^\d+\.\d+$/.test(paramValue)) {
          paramValue = parseFloat(paramValue);
        } else if ((paramValue.startsWith('{') && paramValue.endsWith('}')) ||
                   (paramValue.startsWith('[') && paramValue.endsWith(']'))) {
          try {
            paramValue = JSON.parse(paramValue);
          } catch {
            // Keep as string
          }
        }

        arguments_[paramName] = paramValue;
      }

      toolCalls.push({
        id: `dsml_tool_${Date.now()}_${callIndex++}`,
        name: toolName,
        arguments: arguments_,
      });
    }
  }

  console.log('[DSMLParser] Total tool calls parsed:', toolCalls.length);
  return toolCalls;
}

/**
 * Helper function to parse invoke elements from a block of content
 */
function parseInvokes(content: string, toolCalls: DSMLToolCall[], idGenerator: () => string): void {
  // Match all invoke tags (correct closing tag: </｜｜DSML｜｜invoke>)
  const invokeRegex = /<｜｜DSML｜｜invoke name="([^"]+)"[^>]*>[\s\S]*?<\/｜｜DSML｜｜invoke>/gi;
  let invokeMatch;

  while ((invokeMatch = invokeRegex.exec(content)) !== null) {
    const toolName = invokeMatch[1];
    const invokeContent = invokeMatch[0]; // Use full match to include parameters

    console.log('[DSMLParser] Parsing invoke:', toolName);

    // Parse parameters
    const arguments_: Record<string, any> = {};
    const paramRegex = /<｜｜DSML｜｜parameter name="([^"]+)"(?: string="true")?>([\s\S]*?)<\/｜｜DSML｜｜parameter>/gi;
    let paramMatch;

    while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
      const paramName = paramMatch[1];
      let paramValue: any = paramMatch[2].trim();

      // Try to parse as JSON if it looks like an object or array
      if (paramValue === 'true') {
        paramValue = true;
      } else if (paramValue === 'false') {
        paramValue = false;
      } else if (paramValue === 'null') {
        paramValue = null;
      } else if (/^\d+$/.test(paramValue)) {
        paramValue = parseInt(paramValue, 10);
      } else if (/^\d+\.\d+$/.test(paramValue)) {
        paramValue = parseFloat(paramValue);
      } else if ((paramValue.startsWith('{') && paramValue.endsWith('}')) ||
                 (paramValue.startsWith('[') && paramValue.endsWith(']'))) {
        try {
          paramValue = JSON.parse(paramValue);
        } catch {
          // Keep as string
        }
      }

      arguments_[paramName] = paramValue;
      console.log('[DSMLParser]   param:', paramName, '=', paramValue);
    }

    toolCalls.push({
      id: idGenerator(),
      name: toolName,
      arguments: arguments_,
    });
  }
}

/**
 * Remove DSML tool calls from content and return clean text
 */
export function cleanDSMLFromContent(content: string): string {
  // Remove DSML tool_calls blocks (correct closing tag: </｜｜DSML｜｜tool_calls>)
  let cleaned = content.replace(/<｜｜DSML｜｜tool_calls>[\s\S]*?<\/｜｜DSML｜｜tool_calls>/gi, '');

  // Remove standalone invoke blocks
  cleaned = cleaned.replace(/<｜｜DSML｜｜invoke name="[^"]*"[^>]*>[\s\S]*?<\/｜｜DSML｜｜invoke>/gi, '');

  // Clean up any remaining DSML tags
  cleaned = cleaned.replace(/<｜｜DSML｜｜\s*>/g, '');
  cleaned = cleaned.replace(/<\/｜｜DSML｜｜\s*>/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Check if content contains DSML tool calls
 */
export function hasDSMLToolCalls(content: string): boolean {
  // Check for tool_calls block with closing tag (correct tag: </｜｜DSML｜｜tool_calls>)
  if (/<｜｜DSML｜｜tool_calls>[\s\S]*?<\/｜｜DSML｜｜tool_calls>/i.test(content)) {
    return true;
  }
  // Check for standalone invoke tags
  if (/<｜｜DSML｜｜invoke name="[^"]+"[^>]*>[\s\S]*?<\/｜｜DSML｜｜invoke>/i.test(content)) {
    return true;
  }
  return false;
}
