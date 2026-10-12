(() => {
  const converters = [
    ['Volume','volume','liter milliliter gallon quart pint cup fluid ounce cubic meter cubic foot'],
    ['Length','length','meter kilometer centimeter millimeter micrometer nanometer mile yard foot inch nautical mile'],
    ['Weight and mass','weight-and-mass','kilogram gram milligram metric ton pound ounce stone microgram'],
    ['Temperature','temperature','celsius fahrenheit kelvin'],
    ['Energy','energy','joule kilojoule calorie kilocalorie watt hour kilowatt hour electronvolt btu'],
    ['Area','area','square meter square kilometer square centimeter square millimeter hectare acre square mile square yard square foot square inch'],
    ['Speed','speed','meter per second kilometer per hour mile per hour knot foot per second'],
    ['Time','time','second millisecond microsecond nanosecond minute hour day week month year'],
    ['Power','power','watt kilowatt megawatt horsepower metric horsepower btu per hour'],
    ['Data','data','bit byte kilobit kilobyte megabit megabyte gigabit gigabyte terabit terabyte kibibit kibibyte mebibyte gibibyte'],
    ['Pressure','pressure','pascal kilopascal bar atmosphere psi torr millimeter mercury mmhg'],
    ['Angle','angle','degree radian gradian arcminute arcsecond turn']
  ];
  const root = document.documentElement;
  root.dataset.theme = localStorage.getItem('simpletools-calculator-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const toggle = document.getElementById('themeToggle');
  toggle.onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('simpletools-calculator-theme', root.dataset.theme); };
  const list = document.getElementById('converterList');
  const search = document.getElementById('converterSearch');
  function render() {
    const query = search.value.trim().toLowerCase();
    const found = converters.filter(([name,,keywords]) => `${name} ${keywords}`.toLowerCase().includes(query));
    list.innerHTML = found.map(([name,slug,keywords]) => `<a class="converter-tile" href="converter/${slug}.html"><span class="converter-tile-icon" aria-hidden="true">${iconFor(slug)}</span><span><strong>${name}</strong><small>${keywords.split(' ').slice(0,5).join(' · ')}${keywords.split(' ').length > 5 ? ' · …' : ''}</small></span><span aria-hidden="true">›</span></a>`).join('');
    document.getElementById('noMatches').classList.toggle('hidden', found.length > 0);
    document.getElementById('searchSummary').textContent = query ? `${found.length} of ${converters.length} converters match “${search.value.trim()}”.` : `${converters.length} converters available`;
  }
  function iconFor(slug) { return ({volume:'◉',length:'↔', 'weight-and-mass':'⚖',temperature:'♨',energy:'ϟ',area:'▱',speed:'➤',time:'◷',power:'ϟ',data:'▤',pressure:'◉',angle:'∠'})[slug]; }
  search.addEventListener('input', render);
  render();
})();
