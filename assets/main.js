var KCRWBuddy = (function(){
  
  // data to pull AJAX data from. currently, we're pulling from the same host 
  // to avoid cross-domain issues. this accomplished by a simple apache 
  // proxypass directive that passes the request to kcrw.org.
  var AJAX_HOSTNAME = window.location.host;
  
  // KCRW's default album art image
  var DEFAULT_ALBUM_ART = "/images/no_album.jpg";

  // let's not be too noisy. KCRW has their web page throttled to every 20s, 
  // so let's do the same.
  var REFRESH_INTERVAL = 20 * 1000;

  // holds timeout reference so we can cancel it if need be
  var timeout = null;

  function retrieveNowPlaying(){
    // values are "Music" or "Simulcast"
    var channel = "Music";

    // channel seems to be the only required parameter to retrieve the now playing data for the "Music" channel
    var request_data = {
      "channel" : channel
      // "dates" : "2013-10-03",
      // "hours" : "13",
      // "drive_flag" : "0"
    };

    // fetch the JSON data via AJAX
    $.ajax({
      'type'     : 'GET',
      'url'      : 'http://' + AJAX_HOSTNAME + '/tracklists/includes/table_currenthour.php?data=' + JSON.stringify(request_data),
      'dataType' : 'json',
      'success'  : handleResponseSuccess,
      'error'    : handleResponseError
    });
  }

  function handleResponseSuccess(data){
    // parse and tweak the data
    var song_data = parseNowPlayingData($(data.message));
    song_data = fixNowPlayingData(song_data);

    // show the data
    displayNowPlaying(song_data);

    // load more data later
    timeout = setTimeout(retrieveNowPlaying, REFRESH_INTERVAL);

    // show everything now that we have data
    // yeah, this will get called every time, but who cares. it's harmless.
    $('#now-playing').removeClass('invisible');
  }

  function handleResponseError(data){
    // FIXME: do something more intelligent here
    console.log("handleResponseError");
    console.log(arguments);
  }

  // pull the data out of HTML and into an object
  function parseNowPlayingData(markup){
    var song_data = {
      // FIXME: wonder how text() handles HTML entities
      song     : markup.children('.song').text(),
      artist   : markup.children('.artist').text(),
      album    : markup.children('.album').text(),
      label    : markup.children('.label').text(),
      datetime : markup.find('.time span').text(),
      albumart : markup.find('.buy img').attr('src'),
      website  : markup.find('.details a').attr('href')
    };

    return song_data;
  }

  // correct some things about the parsed data
  function fixNowPlayingData(data){
    // correct the time to be in user's timezone, not America/Los_Angeles.
    // 
    // i need a way to *interpret* the time in America/Los_Angeles and then 
    // display it in the local time zone. you'd think this would be easy, but 
    // it's not due to DST. the simmplest approach seems to be detect DST 
    // and then hardcode the # hours offset when making a new date.
    var offset = moment(data.datetime).isDST() ? "-0700" : "-0800";
    var localtime = new Date(Date.parse(data.datetime + ' GMT ' + offset));

    // note: keep time stored as string; easier that way since we're not 
    // doing any further calcs
    data.datetime = moment(localtime).format('h:mm A');

    return data;
  }

  // shove the data into our page
  function displayNowPlaying(data){
    // link to artist website if available
    if (data.website) {
      $('#artist').html('<a href="' + data.website + '" target="_blank">' + data.artist + '<\/a>');
    } else {
      $('#artist').html(data.artist);
    }

    $('#song').html(data.song);

    if (!data.album) {
      $('#album-info').hide();
      $('#album').html("");
    } else {
      $('#album').html(data.album);
      $('#album-info').show();
    }

    // don't show the square parens if there's no label
    if (!data.label) {
      $('#label-info').hide();
      $('#label').html("");
    } else {
      $('#label').html(data.label);
      $('#label-info').show();
    }

    $('#datetime').html(data.datetime);

    if (!data.albumart) {
      $('#albumart').attr('src', DEFAULT_ALBUM_ART);
    } else {
      $('#albumart').attr('src', data.albumart);
    }
  }

  function handleAlbumArtClick() {
    // stop the timer before we refresh the data
    clearTimeout(timeout);

    retrieveNowPlaying();
  }

  return {
    init : function(){
      retrieveNowPlaying();

      // hidden feature! click the album art to refresh
      $('#albumart').on('click', handleAlbumArtClick)
    }
  };

}());

KCRWBuddy.init();
