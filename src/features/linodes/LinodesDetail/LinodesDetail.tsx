import * as React from 'react';
import * as moment from 'moment';
import Axios from 'axios';
import {
  matchPath,
  withRouter,
  Route,
  Switch,
  RouteComponentProps,
  Redirect,
} from 'react-router-dom';
import { Subscription } from 'rxjs/Rx';

import Typography from 'material-ui/Typography';
import AppBar from 'material-ui/AppBar';
import Tabs, { Tab } from 'material-ui/Tabs';
import Grid from 'material-ui/Grid';

import { events$ } from 'src/events';
import { newLinodeEvents } from 'src/features/linodes/events';
import { API_ROOT } from 'src/constants';
import PromiseLoader, { PromiseLoaderResponse } from 'src/components/PromiseLoader/PromiseLoader';
import LinodeSummary from './LinodeSummary';
import LinodePowerControl from './LinodePowerControl';
import LinodeConfigSelectionDrawer from 'src/features/LinodeConfigSelectionDrawer';

type Props = RouteComponentProps<{ linodeId?: number }>;

interface Data {
  linode: Linode.Linode;
  type?: Linode.LinodeType;
  image?: Linode.Image;
  volumes: Linode.Volume[];
}

interface ConfigDrawerState {
  open: boolean;
  configs: Linode.Config[];
  error?: string;
  selected?: number;
  action?: (id: number) => void;
}

interface State {
  configDrawer: ConfigDrawerState;
  linode: Linode.Linode & { recentEvent?: Linode.Event };
}

interface PreloadedProps {
  data: PromiseLoaderResponse<Data>;
}

const preloaded = PromiseLoader<Props>({
  data: ((props) => {
    const { match: { params: { linodeId } } } = props;
    return Axios.get(`${API_ROOT}/linode/instances/${linodeId}`)
      .then((response) => {
        const { data: linode } = response;
        const finalData: Data = {
          linode,
          type: undefined,
          image: undefined,
          volumes: [],
        };

        linode.image &&
          Axios.get(`${API_ROOT}/images/${linode.image}`)
            .then((response) => {
              finalData.image = response.data;
            });

        Axios.get(`${API_ROOT}/linode/types/${linode.type}`)
          .then((response) => {
            finalData.type = response.data;
          });

        Axios.get(`${API_ROOT}/linode/instances/${linode.id}/volumes`)
          .then((response) => {
            finalData.volumes = response.data;
          });

        return finalData;
      });
  }),
});

type CombinedProps = Props & PreloadedProps;

class LinodeDetail extends React.Component<CombinedProps, State> {
  subscription: Subscription;

  state = {
    linode: this.props.data.response.linode,
    configDrawer: {
      open: false,
      configs: [],
      error: undefined,
      selected: undefined,
      action: (id: number) => null,
    },
  };

  componentWillUnmount() {
    this.subscription.unsubscribe();
  }

  componentDidMount() {
    const mountTime = moment().subtract(5, 'seconds');
    this.subscription = events$
      /* TODO: factor out this filter using a higher-order function that
         takes mountTime */
      .filter(newLinodeEvents(mountTime))
      .subscribe((linodeEvent) => {
        Axios.get(`${API_ROOT}/linode/instances/${(linodeEvent.entity as Linode.Entity).id}`)
          .then(response => response.data)
          .then(linode => this.setState(() => {
            linode.recentEvent = linodeEvent;
            return { linode };
          }));
      });
  }

  handleTabChange = (event: React.ChangeEvent<HTMLDivElement>, value: number) => {
    const { history } = this.props;
    const routeName = this.tabs[value].routeName;
    history.push(`${routeName}`);
  }

  tabs = [
    /* NB: These must correspond to the routes inside the Switch */
    { routeName: `${this.props.match.url}/summary`, title: 'Summary' },
  ];

  openConfigDrawer = (configs: Linode.Config[], action: (id: number) => void) => {
    this.setState({
      configDrawer: {
        open: true,
        configs,
        selected: configs[0].id,
        action,
      },
    });
  }

  closeConfigDrawer = () => {
    this.setState({
      configDrawer: {
        open: false,
        configs: [],
        error: undefined,
        selected: undefined,
        action: (id: number) => null,
      },
    });
  }

  selectConfig = (id: number) => {
    this.setState(prevState => ({
      configDrawer: {
        ...prevState.configDrawer,
        selected: id,
      },
    }));
  }

  submitConfigChoice = () => {
    const { action, selected } = this.state.configDrawer;
    if (selected) {
      action(selected);
      this.closeConfigDrawer();
    }
  }

  render() {
    const { match: { path, url } } = this.props;
    const { type, image, volumes } = this.props.data.response;
    const { linode, configDrawer } = this.state;
    const matches = (p: string) => Boolean(matchPath(p, { path: this.props.location.pathname }));

    return (
      <div>
        <Grid container justify="space-between">
          <Grid item>
            <Typography variant="headline">
              {linode.label}
            </Typography>
          </Grid>
          <Grid item>
            <LinodePowerControl
              status={linode.status}
              id={linode.id}
              label={linode.label}
              openConfigDrawer={this.openConfigDrawer}
            />
          </Grid>
        </Grid>
        <AppBar position="static" color="default">
          <Tabs
            value={this.tabs.findIndex(tab => matches(tab.routeName))}
            onChange={this.handleTabChange}
            indicatorColor="primary"
            textColor="primary"
          >
            {this.tabs.map(tab => <Tab key={tab.title} label={tab.title} />)}
          </Tabs>
        </AppBar>
        <Switch>
          <Route exact path={`${url}/summary`} render={() => (
            <LinodeSummary linode={linode} type={type} image={image} volumes={volumes}/>
          )} />
          <Route exact path={`${path}/`} render={() => (<Redirect to={`${url}/summary`} />)} />
        </Switch>
        <LinodeConfigSelectionDrawer
          onClose={this.closeConfigDrawer}
          onSubmit={this.submitConfigChoice}
          onChange={this.selectConfig}
          open={configDrawer.open}
          configs={configDrawer.configs}
          selected={String(configDrawer.selected)}
          error={configDrawer.error}
        />
      </div>
    );
  }
}

export default withRouter(preloaded(LinodeDetail));
