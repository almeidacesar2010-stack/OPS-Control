import { ChecklistTemplateDef, OperationalChecklistData, ChecklistModelType } from '../types/checklists';

export const CHECKLIST_TEMPLATES: Record<ChecklistModelType, ChecklistTemplateDef> = {
  CCU: {
    type: 'CCU',
    title: 'CHECKLIST OPERACIONAL - CCU (CONTAINERS & BASKETS)',
    code: 'CHK-CCU-01',
    familyMatch: ['CCUs', 'CCU', 'CONTAINER', 'BASKET', 'CAIXA', 'SKID'],
    hasSlingSection: true,
    hasGpsSection: true,
    hasLeakTestSection: false,
    hasDropsSection: true,
    hasPartsReplacementSection: true,
    sections: [
      {
        id: 'estrutura_ccu',
        title: 'ESTRUTURA E INTEGRIDADE VISUAL DO CCU',
        code: 'SEC-01',
        items: [
          { id: 'primaryStructureCheck', label: 'ESTRUTURA PRIMÁRIA (Colunas, vigas principais, olhais de canto e integridade do quadro)' },
          { id: 'secondaryStructureCheck', label: 'ESTRUTURA SECUNDÁRIA (Paredes, perfis intermediários, painéis laterais e reforços)' },
          { id: 'damagedBagCheck', label: 'BOLSA DE EMPILHADEIRA (Entradas de garfo, chapas de desgaste e travas de segurança)' },
          { id: 'bottomCheck', label: 'ESTRUTURA DO FUNDO / SOALHO (Chapa de piso, drenos, travessas inferiores e fixações)' },
          { id: 'roofCheck', label: 'ESTRUTURA DO TETO / COBERTURA (Chapa superior, pontos de drenagem e travamento)' },
          { id: 'tieDownPointCheck', label: 'PONTOS DE AMARRAÇÃO E OLHAIS (Olhais de içamento / pad eyes, anéis de amarração interna)' },
          { id: 'doorCheck', label: 'PORTA DE ACESSO E VEDAÇÃO (Alinhamento das folhas, batentes, borrachas de vedação e trincos)' },
          { id: 'lidCheck', label: 'TAMPA DE INSPEÇÃO / ESCOTILHA (Fechamentos basculantes, travas de segurança e dobradiças)' },
          { id: 'weldsCheck', label: 'SOLDAS ESTRUTURAIS (Ausência de trincas, descontinuidades ou porosidades)' },
          { id: 'corrosionPaintCheck', label: 'PINTURA E CORROSÃO (Revestimento anticorrosivo, aderência e ausência de oxidação severa)' },
          { id: 'nameplateCheck', label: 'PLAQUETA DE IDENTIFICAÇÃO E DADOS TÉCNICOS (Legibilidade da tara, payload, mgw e data de teste)' }
        ]
      },
      {
        id: 'pecas_ccu',
        title: 'TROCA DE PEÇAS & MANUTENÇÃO DE COMPONENTES CCU',
        code: 'SEC-02',
        items: [
          { id: 'leverCheck', label: 'ALAVANCA DE ACIONAMENTO (Mecanismo de abertura/fechamento das portas)' },
          { id: 'leverSupportCheck', label: 'SUPORTE DA ALAVANCA (Base de fixação e guia)' },
          { id: 'roundHeadRivetCheck', label: 'REBITE CABEÇA REDONDA (Fixação de trincos e plaquetas)' },
          { id: 'clawCheck', label: 'GARRA DO VARÃO (Engates superiores e inferiores das portas)' },
          { id: 'retainerCheck', label: 'RETAINER / RETENTOR (Mancais de retenção e buchas)' },
          { id: 'rodCheck', label: 'VARÃO DE FECHAMENTO (Varões verticais de travamento)' },
          { id: 'simpleRodSupportCheck', label: 'ABRAÇADEIRA DO VARÃO SIMPLES (Guia intermediária do varão)' },
          { id: 'specialRodSupportCheck', label: 'ABRAÇADEIRA DO VARÃO ESPECIAL (Fixações reforçadas)' },
          { id: 'rodLockCheck', label: 'TRAVA DO VARÃO (Dispositivo de travamento e porta-cadeado/lacre)' },
          { id: 'hingeCheck', label: 'DOBRADIÇA (Pinos de articulação, lubrificação e soldas)' }
        ]
      }
    ],
    defaultPhotos: [
      { id: 'p_front', title: '1. Vista Frontal (Portas Fechadas)' },
      { id: 'p_lat_r', title: '2. Vista Lateral Direita' },
      { id: 'p_lat_l', title: '3. Vista Lateral Esquerda' },
      { id: 'p_back', title: '4. Vista Traseira' },
      { id: 'p_top', title: '5. Vista Superior / Teto' },
      { id: 'p_inside', title: '6. Interior e Soalho' },
      { id: 'p_plate', title: '7. Plaqueta de Dados Técnicos / Certificação' },
      { id: 'p_nc', title: '8. Detalhe de Não Conformidade (Se houver)' }
    ]
  },

  TANQUE_1500: {
    type: 'TANQUE_1500',
    title: 'CHECKLIST OPERACIONAL - TANQUE DE 1500 LT',
    code: 'CHK-TNK-1500',
    familyMatch: ['Tanques de 1500L', '1500L', '1500 LT', '1500'],
    hasSlingSection: true,
    hasGpsSection: true,
    hasLeakTestSection: true,
    hasDropsSection: true,
    hasPartsReplacementSection: false,
    sections: [
      {
        id: 'estrutura_1500',
        title: 'ESTRUTURA, CHASSI E PROTEÇÃO DO TANQUE 1500L',
        code: 'SEC-01',
        items: [
          { id: 'frameStructureCheck', label: 'ESTRUTURA METÁLICA / CHASSI EXTERNO (Colunas, cantoneiras e tubos de proteção)' },
          { id: 'forkliftPocketCheck', label: 'BOLSAS DE EMPILHADEIRA (Desgaste, aberturas e integridade estrutural)' },
          { id: 'bottomSupportCheck', label: 'BASE E APOIO INFERIOR DO VASO (Coxins, apoios de borracha e chapas de fixação)' },
          { id: 'liftingPointsCheck', label: 'OLHAIS DE IÇAMENTO / PAD EYES (Ausência de trincas, deformações ou desgastes nos furos)' },
          { id: 'topGuardCheck', label: 'GRADE DE PROTEÇÃO SUPERIOR / GUARDA-CORPO (Fixações, dobradiças e travas)' },
          { id: 'groundingCheck', label: 'TERMINAL DE ATERRAMENTO (Parafuso de bronze/inox, fita de aterramento e identificação)' },
          { id: 'paintCorrosionCheck', label: 'PINTURA E ESTADO DE CORROSÃO EXTERNA (Proteção anticorrosiva e pintura do frame)' }
        ]
      },
      {
        id: 'vaso_1500',
        title: 'VASO DE PRESSÃO E CORPO DO TANQUE 1500L',
        code: 'SEC-02',
        items: [
          { id: 'shellVesselCheck', label: 'COSTADO E CALOTAS DO TANQUE (Ausência de amassados, mossas, estufamentos ou trincas)' },
          { id: 'weldsVesselCheck', label: 'CORDÕES DE SOLDA DO VASO (Inspeção visual de soldas circunferenciais e bocais)' },
          { id: 'internalCleaningCheck', label: 'INSPEÇÃO E LIMPEZA INTERNA (Ausência de resíduos químicos, incrustações ou água)' },
          { id: 'dataPlate1500Check', label: 'PLAQUETA DE IDENTIFICAÇÃO TÉCNICA (Capacidade 1500L, pressão de teste, fabricante e serial)' }
        ]
      },
      {
        id: 'valvulas_1500',
        title: 'SISTEMA DE VÁLVULAS, CONEXÕES E ACESSÓRIOS 1500L',
        code: 'SEC-03',
        items: [
          { id: 'bottomValve1500Check', label: 'VÁLVULA DE DESCARGA / FUNDO (Estanqueidade, vedação, alavanca e flange)' },
          { id: 'prvValve1500Check', label: 'VÁLVULA DE ALÍVIO DE PRESSÃO E VÁCUO / PRV (Calibração, mola, sede e corta-chamas)' },
          { id: 'ventValve1500Check', label: 'VÁLVULA DE RESPIRO / EQUALIZAÇÃO DE VAPOR (Operação suave e ausência de obstruções)' },
          { id: 'manhole1500Check', label: 'BOCA DE VISITA / ESCOTILHA SUPERIOR (Junta de vedação, parafusos basculantes e aperto)' },
          { id: 'camlock1500Check', label: 'CONEXÕES RÁPIDAS / ACOPLAMENTOS CAMLOCK (Garras, anéis de vedação e travas de segurança)' },
          { id: 'capsAndPlugsCheck', label: 'TAMPÕES, PLUGS E CAPAS DE PROTEÇÃO (Cabos de segurança antiperda e vedações)' }
        ]
      }
    ],
    defaultPhotos: [
      { id: 'p_front_v', title: '1. Vista Frontal (Conjunto de Válvulas e Conexões)' },
      { id: 'p_lat_r', title: '2. Vista Lateral Direita do Tanque' },
      { id: 'p_lat_l', title: '3. Vista Lateral Esquerda do Tanque' },
      { id: 'p_back', title: '4. Vista Traseira do Frame' },
      { id: 'p_top_manhole', title: '5. Vista Superior (Boca de Visita e Válvula de Alívio PRV)' },
      { id: 'p_bottom_valve', title: '6. Detalhe da Válvula de Fundo / Descarga' },
      { id: 'p_plate_1500', title: '7. Plaqueta Técnica e Dados de Certificação' },
      { id: 'p_nc_detail', title: '8. Detalhe de Não Conformidade (Se houver)' }
    ]
  },

  TANQUE_5000: {
    type: 'TANQUE_5000',
    title: 'CHECKLIST OPERACIONAL - TANQUE DE 5000 LT',
    code: 'CHK-TNK-5000',
    familyMatch: ['Tanques de 5000L', 'Tanques de 5000/5200L', '5000L', '5000 LT', '5000'],
    hasSlingSection: true,
    hasGpsSection: true,
    hasLeakTestSection: true,
    hasDropsSection: true,
    hasPartsReplacementSection: false,
    sections: [
      {
        id: 'chassi_5000',
        title: 'ESTRUTURA OFFSHORE, CHASSI E ACESSOS 5000L (DNV / ISO)',
        code: 'SEC-01',
        items: [
          { id: 'frameDnv5000Check', label: 'FRAME PRINCIPAL OFFSHORE (Colunas estruturais, cantoneiras ISO e ausência de empenos)' },
          { id: 'liftingPadEyes5000Check', label: 'OLHAIS DE IÇAMENTO SUPERIORES (Pad eyes certificados, espessura e furos de pino)' },
          { id: 'forkliftPockets5000Check', label: 'BOLSAS DE EMPILHADEIRA (Integridade, reforços e chapas antidesgaste)' },
          { id: 'ladder5000Check', label: 'ESCADA DE ACESSO AO TOPO (Degraus antiderrapantes, fixações e afastamento de segurança)' },
          { id: 'walkway5000Check', label: 'PASSADIÇO SUPERIOR ANTIDERRAPANTE (Grades de piso serrilhadas e fixações)' },
          { id: 'handrail5000Check', label: 'GUARDA-CORPO DOBRÁVEL / FIXO (Travas de travamento e pinos de segurança)' },
          { id: 'grounding5000Check', label: 'PONTO DE ATERRAMENTO ESTÁTICO (Conector de cobre/inox e sinalização de aterramento)' },
          { id: 'coating5000Check', label: 'REVESTIMENTO E PINTURA DO CHASSI (Pintura epóxi/poliuretano offshore e nível de corrosão)' }
        ]
      },
      {
        id: 'corpo_5000',
        title: 'VASO CILÍNDRICO DE PRESSÃO 5000L',
        code: 'SEC-02',
        items: [
          { id: 'shellVessel5000Check', label: 'COSTADO CILÍNDRICO (Inspeção dimensional visual, ausência de mossas ou deformações)' },
          { id: 'heads5000Check', label: 'CALOTAS / TAMPOS TORISFÉRICOS (Superfícies conformadas e ausência de sobrepressão)' },
          { id: 'weldsInspection5000Check', label: 'CORDÕES DE SOLDA DO TANQUE (Soldas estruturais e de fechamento sem descontinuidades)' },
          { id: 'internalVessel5000Check', label: 'INTERIOR DO TANQUE (Superfície limpa, isenta de contaminantes, vapores ou incrustações)' },
          { id: 'nameplateImdg5000Check', label: 'PLACA DE DADOS IMDG / ASME / DNV (Dados de fabricação, volume 5000L, pressões de teste e ensaios)' }
        ]
      },
      {
        id: 'linhas_valvulas_5000',
        title: 'LINHAS DE CARGA, DESCARGA E VÁLVULAS DE SEGURANÇA 5000L',
        code: 'SEC-03',
        items: [
          { id: 'footValve5000Check', label: 'VÁLVULA DE FUNDO (Foot Valve / Válvula interna de emergência com cabo/acionador)' },
          { id: 'secondaryDischarge5000Check', label: 'VÁLVULA SECUNDÁRIA DE DESCARGA (Válvula de esfera/borboleta com alavanca e trava)' },
          { id: 'prvSafetyValve5000Check', label: 'VÁLVULA DE ALÍVIO DE PRESSÃO E VÁCUO (PRV calibrada com lacre e corta-chamas)' },
          { id: 'airInletValve5000Check', label: 'VÁLVULA DE ENTRADA / RESPIRO DE AR (Válvula 1.5" / 2" com tampão cego e corrente)' },
          { id: 'manholeCover5000Check', label: 'BOCA DE VISITA (Manhole 500mm com parafusos basculantes tipo swing bolt)' },
          { id: 'manholeGasket5000Check', label: 'JUNTA DE VEDAÇÃO DA BOCA DE VISITA (Material PTFE / Viton íntegro sem ressecamento)' },
          { id: 'samplingValve5000Check', label: 'VÁLVULA DE AMOSTRAGEM / DRENO SUPERIOR (Operação suave e vedação)' },
          { id: 'connections5000Check', label: 'CONEXÕES DE ENGATE RÁPIDO (Camlock com travas de segurança e tampões de vedação)' }
        ]
      }
    ],
    defaultPhotos: [
      { id: 'p_front_5000', title: '1. Vista Frontal (Quadro de Válvulas e Acionamento de Emergência)' },
      { id: 'p_lat_r_5000', title: '2. Vista Lateral Direita (Frame e Costado)' },
      { id: 'p_lat_l_5000', title: '3. Vista Lateral Esquerda e Escada de Acesso' },
      { id: 'p_back_5000', title: '4. Vista Traseira do Tanque' },
      { id: 'p_top_walkway_5000', title: '5. Passadiço Superior, Boca de Visita e Válvula de Alívio' },
      { id: 'p_valve_box_5000', title: '6. Detalhe da Caixa de Válvulas e Conexões de Descarga' },
      { id: 'p_plate_imdg_5000', title: '7. Placas Técnicas DNV 2.7-1 / IMDG / Inspeções Periódicas' },
      { id: 'p_nc_5000', title: '8. Registro Fotográfico de Não Conformidades (Se houver)' }
    ]
  },

  TANQUE_5200: {
    type: 'TANQUE_5200',
    title: 'CHECKLIST OPERACIONAL - TANQUE DE 5200 LT',
    code: 'CHK-TNK-5200',
    familyMatch: ['Tanques de 5200L', 'Tanques de 5000/5200L', '5200L', '5200 LT', '5200'],
    hasSlingSection: true,
    hasGpsSection: true,
    hasLeakTestSection: true,
    hasDropsSection: true,
    hasPartsReplacementSection: false,
    sections: [
      {
        id: 'chassi_5200',
        title: 'ESTRUTURA OFFSHORE E CHASSI 5200L (DNV / ISO FRAME)',
        code: 'SEC-01',
        items: [
          { id: 'frameDnv5200Check', label: 'FRAME METÁLICO TUBULAR / PERFIS REFORÇADOS (Estrutura primária ISO/DNV sem trincas ou deformações)' },
          { id: 'liftingEyes5200Check', label: 'OLHAIS DE IÇAMENTO SUPERIORES E INFERIORES (Espessura, integridade dimensional e soldas)' },
          { id: 'forkliftPockets5200Check', label: 'BOLSAS DE EMPILHADEIRA (Alinhamento, guias e reforços laterais)' },
          { id: 'ladderWalkway5200Check', label: 'ESCADA E PASSADIÇO SUPERIOR (Piso antiderrapante e fixação de suportes)' },
          { id: 'handrailSafety5200Check', label: 'GUARDA-CORPO DE SEGURANÇA (Articulações, pinos de travamento e cabos de segurança)' },
          { id: 'groundingPoint5200Check', label: 'CONEXÃO DE ATERRAMENTO (Terminal bimetálico e identificação visual)' },
          { id: 'frameCoating5200Check', label: 'PINTURA E PROTEÇÃO ANTICORROSIVA DO FRAME (Espessura de película e aderência)' }
        ]
      },
      {
        id: 'vaso_5200',
        title: 'VASO CILÍNDRICO DE PRESSÃO 5200L (AÇO INOXIDÁVEL / CARBONO)',
        code: 'SEC-02',
        items: [
          { id: 'shellVessel5200Check', label: 'CORPO CILÍNDRICO DO VASO (Costado sem amassados, deformações térmicas ou mossas)' },
          { id: 'dishHeads5200Check', label: 'CALOTAS SUPERIOR E INFERIOR (Integridade geométrica das extremidades torisféricas)' },
          { id: 'weldsVessel5200Check', label: 'SOLDAS TIG / MIG DO VASO (Inspeção visual e integridade das juntas soldadas)' },
          { id: 'internalState5200Check', label: 'INSPEÇÃO INTERNA DO VASO (Limpeza técnica, ausência de borras, óleos ou contaminantes)' },
          { id: 'technicalPlate5200Check', label: 'PLACA DE IDENTIFICAÇÃO E ENSAIOS (Capacidade 5200L, normas DNV 2.7-1 / EN 12079 / IMDG)' }
        ]
      },
      {
        id: 'valvulas_5200',
        title: 'VÁLVULAS, BOCA DE VISITA E ACESSÓRIOS OPERACIONAIS 5200L',
        code: 'SEC-03',
        items: [
          { id: 'bottomEmergencyValve5200Check', label: 'VÁLVULA DE FUNDO COM FECHAMENTO DE EMERGÊNCIA (Atuação rápida por cabo e teste de vedação)' },
          { id: 'dischargeValve5200Check', label: 'VÁLVULA DE DESCARGA PRINCIPAL (Válvula de esfera em aço inox com trava de posição)' },
          { id: 'prvReliefValve5200Check', label: 'VÁLVULA DE ALÍVIO DE PRESSÃO E VÁCUO / PRV (Sede, disco, corta-chamas e calibração)' },
          { id: 'vaporRecoveryValve5200Check', label: 'VÁLVULA DE RESPIRO / RECUPERAÇÃO DE VAPORES (Conexão de equalização com tampão e trava)' },
          { id: 'manhole5200Check', label: 'BOCA DE VISITA / MANHOLE 500MM (Parafusos basculantes e porcas borboleta em inox)' },
          { id: 'gasket5200Check', label: 'GAXETA / JUNTA DE VEDAÇÃO DA BOCA DE VISITA (Perfil Viton/PTFE livre de cortes ou deformação)' },
          { id: 'blindFlangesAndCaps5200Check', label: 'TAMPÕES CEGOS, FLANGES E PLUGS (Correntes de retenção e anéis o-ring)' },
          { id: 'camlockQuickCouplings5200Check', label: 'ENGATES RÁPIDOS CAMLOCK (Travas de segurança e ausência de vazamentos)' }
        ]
      }
    ],
    defaultPhotos: [
      { id: 'p_front_5200', title: '1. Vista Frontal (Painel de Válvulas e Acionamento)' },
      { id: 'p_lat_r_5200', title: '2. Vista Lateral Direita (Costado do Vaso 5200L)' },
      { id: 'p_lat_l_5200', title: '3. Vista Lateral Esquerda e Escada' },
      { id: 'p_back_5200', title: '4. Vista Traseira da Estrutura' },
      { id: 'p_top_5200', title: '5. Passarela Superior, Boca de Visita e Válvula de Alívio' },
      { id: 'p_discharge_box_5200', title: '6. Detalhe da Válvula de Fundo e Tubulação de Descarga' },
      { id: 'p_data_plate_5200', title: '7. Plaqueta de Dados Técnicos DNV / IMDG e Testes' },
      { id: 'p_nc_detail_5200', title: '8. Registro Fotográfico de Não Conformidades (Se houver)' }
    ]
  },

  REEFER: {
    type: 'REEFER',
    title: 'CHECKLIST OPERACIONAL - CONTAINER REFRIGERADO (REEFER)',
    code: 'CHK-REF-01',
    familyMatch: ['Container Refrigerado', 'Reefer', 'Refrigerado', 'REEFER'],
    hasSlingSection: true,
    hasGpsSection: true,
    hasLeakTestSection: false,
    hasDropsSection: true,
    hasPartsReplacementSection: true,
    sections: [
      {
        id: 'estrutura_reefer',
        title: 'ESTRUTURA EXTERNA E ISOLAMENTO TÉRMICO',
        code: 'SEC-01',
        items: [
          { id: 'frameCornerCheck', label: 'CANTONEIRAS E QUADRO ESTRUTURAL (Castings de canto ISO, colunas e travessas)' },
          { id: 'thermalPanelsCheck', label: 'PAINÉIS TÉRMICOS / SANDUÍCHE (Ausência de delaminação, furos ou danos no isolamento)' },
          { id: 'reeferDoorSealCheck', label: 'PORTAS TRASEIRAS E VEDAÇÃO (Borrachas de vedação labiais, trincos e varões)' },
          { id: 'floorTDrainCheck', label: 'PISO T-BAR E DRENAGEM (Calhas de circulação de ar limpas e drenos desobstruídos)' },
          { id: 'forkliftReeferCheck', label: 'BOLSAS DE EMPILHADEIRA E CHASSI (Integridade e ausência de empenos)' }
        ]
      },
      {
        id: 'maquina_reefer',
        title: 'UNIDADE DE REFRIGERAÇÃO & SISTEMA ELÉTRICO',
        code: 'SEC-02',
        items: [
          { id: 'compressorCheck', label: 'COMPRESSOR E VENTILADORES (Condensador, evaporador e ausência de ruídos anormais)' },
          { id: 'powerCablePlugCheck', label: 'CABO DE ALIMENTAÇÃO E PLUG INDUSTRIAL (Isolamento, plug 380V/440V e prensa-cabo)' },
          { id: 'controllerDisplayCheck', label: 'CONTROLADOR / DISPLAY DIGITAL (Leitura clara de setpoint e temperatura da câmara)' },
          { id: 'safetyBreakersCheck', label: 'DISJUNTORES E QUADRO ELÉTRICO (Travamento do painel e ausência de umidade interna)' },
          { id: 'refrigerantLevelCheck', label: 'LINHA DE GÁS REFRIGERANTE (Visor de líquido sem bolhas e ausência de vazamentos)' }
        ]
      }
    ],
    defaultPhotos: [
      { id: 'p_front_reefer', title: '1. Vista Frontal (Portas Fechadas e Trincos)' },
      { id: 'p_unit_reefer', title: '2. Unidade de Refrigeração e Painel' },
      { id: 'p_lat_r_reefer', title: '3. Vista Lateral Direita' },
      { id: 'p_lat_l_reefer', title: '4. Vista Lateral Esquerda' },
      { id: 'p_inside_reefer', title: '5. Interior da Câmara e Piso T-Bar' },
      { id: 'p_plug_cable', title: '6. Cabo de Alimentação e Conector Elétrico' },
      { id: 'p_plate_reefer', title: '7. Plaqueta de Dados Técnicos / Certificação' },
      { id: 'p_nc_reefer', title: '8. Registro de Não Conformidade (Se houver)' }
    ]
  }
};

/**
 * Mapeia e detecta o tipo de modelo técnico com base na família, modelo e TAG
 */
export function detectChecklistModel(family: string, subFamily?: string, equipmentTag?: string): ChecklistModelType {
  const combined = `${family || ''} ${subFamily || ''} ${equipmentTag || ''}`.toUpperCase();
  
  if (combined.includes('REEFER') || combined.includes('REFRIGERADO') || combined.includes('CAMARA FRIA')) {
    return 'REEFER';
  }
  if (combined.includes('1500') || combined.includes('1.500') || combined.includes('1325') || combined.includes('1.325')) {
    return 'TANQUE_1500';
  }
  if (combined.includes('5200') || combined.includes('5.200')) {
    return 'TANQUE_5200';
  }
  if (combined.includes('5000') || combined.includes('5.000') || combined.includes('OEGU') || combined.includes('HMHU') || combined.includes('STC-5000')) {
    return 'TANQUE_5000';
  }
  if (combined.includes('CCU') || combined.includes('CONTAINER') || combined.includes('BASKET') || combined.includes('CAIXA') || combined.includes('SKID')) {
    return 'CCU';
  }

  if (family === 'Tanques de 1500L') return 'TANQUE_1500';
  if (family === 'Tanques de 5000/5200L') {
    if ((subFamily || '').includes('5200') || (equipmentTag || '').includes('5200')) {
      return 'TANQUE_5200';
    }
    return 'TANQUE_5000';
  }
  if (family === 'Container Refrigerado') return 'REEFER';
  
  return 'CCU';
}

/**
 * Cria os dados padrão para um novo checklist
 */
export function createDefaultChecklistData(
  modelType: ChecklistModelType, 
  initialInfo: Partial<OperationalChecklistData> = {}
): OperationalChecklistData {
  const template = CHECKLIST_TEMPLATES[modelType] || CHECKLIST_TEMPLATES.CCU;
  const items: Record<string, any> = {};

  template.sections.forEach(section => {
    section.items.forEach(item => {
      items[item.id] = {
        id: item.id,
        label: item.label,
        category: section.title,
        status: 'OK',
        observation: ''
      };
    });
  });

  const photos = template.defaultPhotos.map(p => ({
    id: p.id,
    title: p.title,
    description: '',
    photoUrl: ''
  }));

  const nowStr = new Date().toISOString().split('T')[0];

  return {
    checklistType: initialInfo.checklistType || 'Entrada',
    equipmentFamily: initialInfo.equipmentFamily || (modelType === 'CCU' ? 'CCU' : (modelType === 'TANQUE_1500' ? 'Tanque 1500 LT' : (modelType === 'TANQUE_5000' ? 'Tanque 5000 LT' : (modelType === 'TANQUE_5200' ? 'Tanque 5200 LT' : 'Container Refrigerado')))),
    equipmentModel: initialInfo.equipmentModel || (modelType === 'CCU' ? 'CCU 10\'' : (modelType === 'TANQUE_1500' ? 'Tanque Químico 1500L' : (modelType === 'TANQUE_5000' ? 'Tanque Offshore 5000L' : (modelType === 'TANQUE_5200' ? 'Tanque Inox 5200L' : 'Container Reefer 20\'')))),
    modelType,
    modelTitle: template.title,
    version: '1.0',

    equipmentTag: initialInfo.equipmentTag || '',
    clientId: initialInfo.clientId || '',
    clientName: initialInfo.clientName || '',
    inspectionDate: initialInfo.inspectionDate || nowStr,
    inspectionLocation: initialInfo.inspectionLocation || 'Base OEG - Macaé/RJ',
    inspectionResponsible: initialInfo.inspectionResponsible || initialInfo.inspectorName || 'TÉCNICO OPERACIONAL',
    inspectorName: initialInfo.inspectorName || '',
    inspectorJobTitle: initialInfo.inspectorJobTitle || 'TÉCNICO DE INSPEÇÃO',
    inspectorSignatureUrl: initialInfo.inspectorSignatureUrl || '',
    
    approverName: initialInfo.approverName || '',
    approverJobTitle: initialInfo.approverJobTitle || 'SUPERVISOR QUALIDADE / PCP',
    approverSignatureUrl: initialInfo.approverSignatureUrl || '',

    slingApplicable: template.hasSlingSection,
    slingTag: initialInfo.slingTag || '',
    slingNumber: initialInfo.slingTag || initialInfo.slingNumber || '',
    slingInspectionDate: initialInfo.slingInspectionDate || nowStr,
    slingExpirationDate: initialInfo.slingExpirationDate || '',
    slingStatus: initialInfo.slingStatus || 'OK',
    slingNotes: initialInfo.slingNotes || '',

    hasGps: false,
    gpsTag: '',
    gpsStatus: 'NA',
    gpsNotes: '',

    items,

    leakTestApplicable: template.hasLeakTestSection,
    leakTestPressureBar: template.hasLeakTestSection ? '0.5' : '',
    leakTestDurationMin: template.hasLeakTestSection ? '10' : '',
    leakTestStatus: 'OK',
    leakTestNotes: '',

    dropsCheckStatus: 'OK',
    dropsNotes: '',

    photos,

    status: initialInfo.status || 'Em preenchimento',
    generalNotes: initialInfo.generalNotes || '',
    conforme: true,
    ncCount: 0,
    ...initialInfo
  };
}
