# Registro de validação

Validação local em 21/09/2026, com Node 26, Codex CLI 0.154.0 e Astra (`gpt-6-astra`).

## Verificações automatizadas

- 21 testes passaram: domínio da cena, operações atômicas, bloqueios, escopo por cômodo, nomes de materiais, calibração, histórico, conflitos, recuperação, anexos e integração HTTP.
- TypeScript e build de produção passaram.
- Os testes de falha de conexão, limites, cancelamento e conflito usam um provedor controlado, isolado dos dados reais.

## Interface e documentos

- Planta HM Ponta conferida visualmente contra a página 11 do book.
- Visualização 2D/3D; edição numérica de altura e rotação de móveis.
- Preset de estilo, comparação lado a lado, restauração, desfazer e refazer.
- PDF do book aberto no importador, navegação até a página 11 e recorte da unidade esquerda.
- Recarregamento do navegador e reconexão após reiniciar o backend, conservando projetos e versões.
- Arraste de um Ficus pelo eixo X em planta 2D: posição alterada de 1,25 m para 1,457 m, com nova revisão. Controles ancorados na peça e orientação superior da planta conferidos.

## IA real

A conta ChatGPT foi reconhecida e a lista real de modelos retornou Astra. A primeira tentativa recebeu o erro de workspace sem créditos e preservou a cena. Após o usuário repor os créditos:

1. **Sofá bege:** Astra alterou apenas o material de `hm-12` para `#c8b89c`. Uma revisão foi criada. Os demais objetos, ambientes, paredes e aberturas ficaram idênticos.
2. **Referência visual no quarto:** a imagem do book foi anexada e o quarto de casal selecionado. Astra alterou apenas os materiais da cama `hm-21`. A faixa azul e os travesseiros claros foram conferidos no 3D. A estrutura permaneceu idêntica. O teste revelou aliases de materiais; eles foram normalizados no domínio, e nomes desconhecidos agora são rejeitados.
3. **Estilo industrial:** o pedido alterou sete móveis da sala. A comparação dos snapshots confirmou que outros cômodos, paredes, aberturas, pisos e instalações permaneceram iguais.
4. **Outra planta:** o PDF sintético `tests/fixtures/studio-20m2.pdf` foi processado pelo Astra real. O resultado contém cozinha integrada, banheiro e estar/dormir, seis paredes, duas portas e uma janela. A espessura de uma parede foi corrigida na revisão; o projeto separado foi criado e conferido em 3D. A planta original HM foi preservada. O teste comprova o fluxo para essa topologia, não a precisão para qualquer planta.
5. **Recuperação de alteração real:** desfazer removeu os materiais novos da cama; refazer recuperou a composição azul, sem apagar revisões.

A aplicação normal usa exclusivamente o Codex real. As representações e as medidas inferidas continuam aproximadas; os testes não estabelecem precisão arquitetônica.

## Continuação dos testes — 21/09/2026

- Os 21 testes automatizados foram executados novamente, sem falhas. TypeScript e build de produção passaram.
- A versão de produção foi aberta em `http://127.0.0.1:4310`; a conexão existente com o Codex e a lista de modelos foram reconhecidas.
- No projeto **Studio · teste de importação**, o catálogo foi filtrado por cadeira e uma Cadeira Arco adicionada em **Estar / dormir**. A rotação foi alterada para 45° e persistiu após recarregar a página.
- Uma largura negativa foi rejeitada sem criar versão, mas revelou que o campo mantinha o valor recusado. Corrigido em `NumberField`: o campo mostra a medida salva até a confirmação da alteração; entradas vazias não são convertidas em zero.
- Reteste da correção: largura de −20 cm voltou a 45 cm com aviso de validação; posição X vazia voltou a 200 cm. Uma largura válida de 50 cm foi salva; desfazer retornou a 45 cm e refazer recuperou 50 cm.
- As visualizações 2D e 3D e a comparação lado a lado foram conferidas. Restaurar a versão **Ajustou Ficus** criou a versão 08, recuperando a cena anterior a esta rodada e preservando as versões de teste.
- Esta rodada não enviou novas solicitações de geração à IA. Os testes reais descritos acima pertencem à rodada anterior.
- O build mantém um aviso não bloqueante sobre importação simultaneamente estática e dinâmica do módulo de domínio em `GeometryEditor.tsx`.
