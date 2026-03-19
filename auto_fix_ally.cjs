const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const targetElements = ['div', 'span', 'li', 'img', 'p', 'a'];

function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (e) {
    console.error(`Failed to parse ${filePath}: ${e.message}`);
    return;
  }

  let modified = false;

  traverse(ast, {
    JSXOpeningElement(path) {
      if (t.isJSXIdentifier(path.node.name) && targetElements.includes(path.node.name.name)) {
        const attributes = path.node.attributes;
        const hasOnClick = attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'onClick');
        
        // Ensure it doesn't already have an onKeyDown or role
        const hasRole = attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'role');
        const hasTabIndex = attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'tabIndex');
        const hasOnKeyDown = attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'onKeyDown');

        if (hasOnClick && (!hasRole || !hasTabIndex || !hasOnKeyDown)) {
          // Find the onClick attribute to extract its expression
          const onClickAttr = attributes.find(attr => t.isJSXAttribute(attr) && attr.name.name === 'onClick');
          if (!onClickAttr || !onClickAttr.value || !t.isJSXExpressionContainer(onClickAttr.value)) return;

          const onClickExpr = onClickAttr.value.expression;

          if (!hasRole && path.node.name.name !== 'a') {
            attributes.push(t.jsxAttribute(t.jsxIdentifier('role'), t.stringLiteral('button')));
          }
          if (!hasTabIndex) {
            attributes.push(t.jsxAttribute(t.jsxIdentifier('tabIndex'), t.jsxExpressionContainer(t.numericLiteral(0))));
          }
          if (!hasOnKeyDown) {
            // Create onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); /* call original */ } }}
            const eIdentifier = t.identifier('e');
            const preventDefaultCall = t.expressionStatement(
              t.callExpression(t.memberExpression(eIdentifier, t.identifier('preventDefault')), [])
            );

            // Create call to the original expression
            let originalCall;
            if (t.isArrowFunctionExpression(onClickExpr) || t.isFunctionExpression(onClickExpr)) {
              originalCall = t.expressionStatement(
                t.callExpression(onClickExpr, [eIdentifier])
              );
            } else {
              originalCall = t.expressionStatement(
                t.callExpression(onClickExpr, [eIdentifier])
              );
            }

            const ifStatement = t.ifStatement(
              t.logicalExpression(
                '||',
                t.binaryExpression('===', t.memberExpression(eIdentifier, t.identifier('key')), t.stringLiteral('Enter')),
                t.binaryExpression('===', t.memberExpression(eIdentifier, t.identifier('key')), t.stringLiteral(' '))
              ),
              t.blockStatement([preventDefaultCall, originalCall])
            );

            const onKeyDownArrow = t.arrowFunctionExpression(
              [eIdentifier],
              t.blockStatement([ifStatement])
            );

            attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('onKeyDown'),
                t.jsxExpressionContainer(onKeyDownArrow)
              )
            );
          }
          modified = true;
        }
      }
    }
  });

  if (modified) {
    // Retain comments and formatting somewhat
    const output = generate(ast, {
      retainLines: true,
      compact: false,
    }, code);
    fs.writeFileSync(filePath, output.code, 'utf-8');
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walkDir(dirPath);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.jsx')) {
        processFile(dirPath);
      }
    }
  }
}

walkDir(path.join(__dirname, 'src', 'components'));
console.log('Done scanning components.');
