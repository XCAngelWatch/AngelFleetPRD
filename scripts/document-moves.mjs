import specMoves from './spec-section-moves.json' with {type:'json'};

// Published bookmarks whose content has moved into a topic document.
export function documentMoves(product, roadmap) {
  const featurePage = '1panel-feature-map.html';
  const topicMap = {
    '': '本期功能导图', top: '本期功能导图', '1panel-上游功能': '本期功能导图',
    'angelfleet-迁移范围': '哪些-1panel-功能分批迁移', '范围与验收依据': '当前验收状态'
  };
  const featureGroup = product.sections.find(section => section.heading.id === '本期功能导图');
  for (const token of featureGroup.tokens.filter(token => token.type === 'heading_open')) {
    const id = token.attrGet('id');
    topicMap[id] = id;
  }
  const roadmapTopics = {
    'm1-排期与甘特图':'m1-排期与甘特图', 'm1-开工与联调顺序':'m1-开工与联调顺序',
    '三批派工总览':'后续工作包与估算', '分阶段里程碑':'整版路线与发布条件', 'm1-派工单':'m1-排期与交接',
    'm1-之后的派工单':'后续工作包与估算', '共用写入协议与节点执行':'ga-11',
    '首批功能的后续扩展':'首批扩展的七项工单', '后续核心':'核心运维的八项工单', '后续保障':'运行保障的九项工单',
    '代码归属与接口':'m1-排期与交接', '验收证据与排期决策':'整版路线与发布条件'
  };
  for (const {id} of roadmap.records) {
    if (/^(?:ga|follow|core|ops)-\d{2}$/.test(id)) roadmapTopics[id] = id;
  }
  const destinations = (file, mapping) => Object.fromEntries(
    Object.entries(mapping).map(([from, to]) => [from, file + '#' + to])
  );
  return {
    [featurePage]: destinations(product.file, topicMap),
    'technical-plan.html': specMoves,
    'go-agent-development-plan.html': destinations(roadmap.file, roadmapTopics),
    'operation-ledger.html': {
      '命令类操作':'#操作登记与执行边界', '流会话类操作':'#操作登记与执行边界', '共用写入与取证':'#工单与操作登记'
    },
    'platform-constraints.html': {'解释规则':'technical-design.html#部署容量与恢复'},
    'threat-model.html': {
      ...destinations('', Object.fromEntries(['executive-summary','scope-and-assumptions','attacker-model','capabilities','non-capabilities'].map(id => [id,'评估范围与假设']))),
      'assets-and-security-objectives':'#资产与保护目标',
      ...destinations('', Object.fromEntries(['top-abuse-paths','threat-model-table','criticality-calibration'].map(id => [id,'风险评级']))),
      'static-publication-security-baseline':'#静态发布证据',
      ...destinations('technical-design.html', Object.fromEntries(['system-model','primary-components','diagram'].map(id => [id,'系统架构与代码边界']))),
      ...destinations('technical-design.html', Object.fromEntries(['data-flows-and-trust-boundaries','entry-points-and-attack-surfaces','focus-paths-for-security-review','notes-on-use'].map(id => [id,'安全边界如何验收'])))
    },
    'review-2026-11-19.html': {'仍需决策和实测的事项': product.file + '#当前验收状态'}
  };
}
